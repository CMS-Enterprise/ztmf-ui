import {
  saveDraft,
  loadDraft,
  clearDraft,
  clearOtherUserDrafts,
  __resetKeyCache,
  __setKeyForTesting,
  __setHashedIdForTesting,
  QuestionDraft,
  DRAFT_VERSION,
} from './draftStore'

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000

const USER = 'user-abc'
const USER_A = 'user-a'
const USER_B = 'user-b'
const IDS = { fismasystemid: 1, functionid: 2, datacallid: 3 } as const

// Predictable hashes injected via __setHashedIdForTesting so EXPECTED_KEY is stable.
const H_USER = 'h-user-abc'
const H_USER_A = 'h-user-a'
const H_USER_B = 'h-user-b'
const EXPECTED_KEY = `ztmf_draft_${H_USER}_1_2_3`

const DRAFT: QuestionDraft = { selectQuestionOption: 5, notes: 'test notes' }

// Two distinct keys so cross-user isolation tests behave correctly.
let keyA: CryptoKey
let keyB: CryptoKey

beforeAll(async () => {
  const params = { name: 'AES-GCM', length: 256 } as const
  const uses: KeyUsage[] = ['encrypt', 'decrypt']
  keyA = await crypto.subtle.generateKey(params, false, uses)
  keyB = await crypto.subtle.generateKey(params, false, uses)
})

// Helper: encrypt an arbitrary payload with a given key (for shape/version tests).
async function encryptRaw(
  key: CryptoKey,
  payload: unknown
): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = new TextEncoder().encode(JSON.stringify(payload))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  )
  return {
    iv: btoa(String.fromCharCode(...iv)),
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
  }
}

beforeEach(() => {
  localStorage.clear()
  // Reset and re-seed both caches so each test starts from known state without
  // touching IndexedDB (unavailable in JSDOM) or SHA-256 digest.
  __resetKeyCache()
  __setKeyForTesting(USER, keyA)
  __setKeyForTesting(USER_A, keyA)
  __setKeyForTesting(USER_B, keyB)
  __setHashedIdForTesting(USER, H_USER)
  __setHashedIdForTesting(USER_A, H_USER_A)
  __setHashedIdForTesting(USER_B, H_USER_B)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('key format', () => {
  it('generates ztmf_draft_{hashedUserId}_{system}_{function}_{datacall}', async () => {
    await saveDraft(
      USER,
      IDS.fismasystemid,
      IDS.functionid,
      IDS.datacallid,
      DRAFT
    )
    expect(localStorage.getItem(EXPECTED_KEY)).not.toBeNull()
  })

  it('different IDs produce different keys', async () => {
    await saveDraft(USER, 1, 2, 3, DRAFT)
    await saveDraft(USER, 1, 2, 4, DRAFT)
    expect(Object.keys(localStorage)).toHaveLength(2)
  })

  it('different userids produce different keys', async () => {
    await saveDraft(USER_A, 1, 2, 3, DRAFT)
    await saveDraft(USER_B, 1, 2, 3, DRAFT)
    expect(Object.keys(localStorage)).toHaveLength(2)
  })
})

describe('saveDraft', () => {
  it('returns true when save succeeds', async () => {
    const result = await saveDraft(
      USER,
      IDS.fismasystemid,
      IDS.functionid,
      IDS.datacallid,
      DRAFT
    )
    expect(result).toBe(true)
  })

  it('returns false without writing when isCurrent returns false before encryption', async () => {
    const result = await saveDraft(
      USER,
      IDS.fismasystemid,
      IDS.functionid,
      IDS.datacallid,
      DRAFT,
      () => false
    )
    expect(result).toBe(false)
    expect(localStorage.getItem(EXPECTED_KEY)).toBeNull()
  })

  it('returns false without writing when isCurrent returns false after encryption', async () => {
    let calls = 0
    const result = await saveDraft(
      USER,
      IDS.fismasystemid,
      IDS.functionid,
      IDS.datacallid,
      DRAFT,
      () => ++calls < 2 // true on first check (pre-encrypt), false on second (pre-write)
    )
    expect(result).toBe(false)
    expect(localStorage.getItem(EXPECTED_KEY)).toBeNull()
  })

  it('returns false when localStorage is unavailable', async () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })
    const result = await saveDraft(
      USER,
      IDS.fismasystemid,
      IDS.functionid,
      IDS.datacallid,
      DRAFT
    )
    expect(result).toBe(false)
  })

  it('writes encrypted JSON with version field to the correct key', async () => {
    await saveDraft(
      USER,
      IDS.fismasystemid,
      IDS.functionid,
      IDS.datacallid,
      DRAFT
    )
    const raw = localStorage.getItem(EXPECTED_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed).toHaveProperty('v', DRAFT_VERSION)
    expect(parsed).toHaveProperty('iv')
    expect(parsed).toHaveProperty('ciphertext')
    expect(parsed).toHaveProperty('savedAt')
    // Stored value must not contain plaintext fields
    expect(parsed).not.toHaveProperty('selectQuestionOption')
    expect(parsed).not.toHaveProperty('notes')
  })

  it('includes a numeric savedAt timestamp', async () => {
    const before = Date.now()
    await saveDraft(
      USER,
      IDS.fismasystemid,
      IDS.functionid,
      IDS.datacallid,
      DRAFT
    )
    const after = Date.now()
    const { savedAt } = JSON.parse(localStorage.getItem(EXPECTED_KEY)!)
    expect(typeof savedAt).toBe('number')
    expect(savedAt).toBeGreaterThanOrEqual(before)
    expect(savedAt).toBeLessThanOrEqual(after)
  })

  it('does not expose savedAt in the decrypted QuestionDraft', async () => {
    await saveDraft(
      USER,
      IDS.fismasystemid,
      IDS.functionid,
      IDS.datacallid,
      DRAFT
    )
    const result = await loadDraft(
      USER,
      IDS.fismasystemid,
      IDS.functionid,
      IDS.datacallid
    )
    expect(result).not.toHaveProperty('savedAt')
  })
})

describe('loadDraft', () => {
  it('returns null for a missing key', async () => {
    expect(
      await loadDraft(USER, IDS.fismasystemid, IDS.functionid, IDS.datacallid)
    ).toBeNull()
  })

  it('round-trips a notes-only draft (selectQuestionOption = -1)', async () => {
    const notesOnly: QuestionDraft = {
      selectQuestionOption: -1,
      notes: 'partial note',
    }
    await saveDraft(
      USER,
      IDS.fismasystemid,
      IDS.functionid,
      IDS.datacallid,
      notesOnly
    )
    const result = await loadDraft(
      USER,
      IDS.fismasystemid,
      IDS.functionid,
      IDS.datacallid
    )
    expect(result).toEqual(notesOnly)
  })

  it('decrypts and returns the original draft fields', async () => {
    await saveDraft(
      USER,
      IDS.fismasystemid,
      IDS.functionid,
      IDS.datacallid,
      DRAFT
    )
    const result = await loadDraft(
      USER,
      IDS.fismasystemid,
      IDS.functionid,
      IDS.datacallid
    )
    expect(result).toEqual(DRAFT)
  })

  it('returns null for a draft decrypted with the wrong user key', async () => {
    await saveDraft(
      USER_A,
      IDS.fismasystemid,
      IDS.functionid,
      IDS.datacallid,
      DRAFT
    )
    // Copy user-a ciphertext (encrypted with keyA) into user-b slot.
    // loadDraft for user-b will try keyB — decrypt fails → null.
    const raw = localStorage.getItem(`ztmf_draft_${H_USER_A}_1_2_3`)!
    localStorage.setItem(`ztmf_draft_${H_USER_B}_1_2_3`, raw)
    const result = await loadDraft(
      USER_B,
      IDS.fismasystemid,
      IDS.functionid,
      IDS.datacallid
    )
    expect(result).toBeNull()
  })

  it('returns null and removes the key when the entry is older than 14 days', async () => {
    await saveDraft(
      USER,
      IDS.fismasystemid,
      IDS.functionid,
      IDS.datacallid,
      DRAFT
    )
    const raw = JSON.parse(localStorage.getItem(EXPECTED_KEY)!)
    localStorage.setItem(
      EXPECTED_KEY,
      JSON.stringify({ ...raw, savedAt: 1000 })
    )
    jest.spyOn(Date, 'now').mockReturnValue(1000 + FOURTEEN_DAYS_MS + 1)

    expect(
      await loadDraft(USER, IDS.fismasystemid, IDS.functionid, IDS.datacallid)
    ).toBeNull()
    expect(localStorage.getItem(EXPECTED_KEY)).toBeNull()
  })

  it('returns a valid draft exactly at the TTL boundary (not yet expired)', async () => {
    await saveDraft(
      USER,
      IDS.fismasystemid,
      IDS.functionid,
      IDS.datacallid,
      DRAFT
    )
    const raw = JSON.parse(localStorage.getItem(EXPECTED_KEY)!)
    localStorage.setItem(
      EXPECTED_KEY,
      JSON.stringify({ ...raw, savedAt: 1000 })
    )
    jest.spyOn(Date, 'now').mockReturnValue(1000 + FOURTEEN_DAYS_MS)

    expect(
      await loadDraft(USER, IDS.fismasystemid, IDS.functionid, IDS.datacallid)
    ).toEqual(DRAFT)
  })

  it('returns null and removes the key when savedAt is missing', async () => {
    await saveDraft(
      USER,
      IDS.fismasystemid,
      IDS.functionid,
      IDS.datacallid,
      DRAFT
    )
    const { savedAt: _, ...withoutSavedAt } = JSON.parse(
      localStorage.getItem(EXPECTED_KEY)!
    )
    localStorage.setItem(EXPECTED_KEY, JSON.stringify(withoutSavedAt))

    expect(
      await loadDraft(USER, IDS.fismasystemid, IDS.functionid, IDS.datacallid)
    ).toBeNull()
    expect(localStorage.getItem(EXPECTED_KEY)).toBeNull()
  })

  it('returns null and evicts when the version field is wrong', async () => {
    await saveDraft(
      USER,
      IDS.fismasystemid,
      IDS.functionid,
      IDS.datacallid,
      DRAFT
    )
    const raw = JSON.parse(localStorage.getItem(EXPECTED_KEY)!)
    localStorage.setItem(EXPECTED_KEY, JSON.stringify({ ...raw, v: 99 }))

    expect(
      await loadDraft(USER, IDS.fismasystemid, IDS.functionid, IDS.datacallid)
    ).toBeNull()
    expect(localStorage.getItem(EXPECTED_KEY)).toBeNull()
  })

  it('returns null and evicts when the version field is missing', async () => {
    await saveDraft(
      USER,
      IDS.fismasystemid,
      IDS.functionid,
      IDS.datacallid,
      DRAFT
    )
    const { v: _, ...withoutV } = JSON.parse(
      localStorage.getItem(EXPECTED_KEY)!
    )
    localStorage.setItem(EXPECTED_KEY, JSON.stringify(withoutV))

    expect(
      await loadDraft(USER, IDS.fismasystemid, IDS.functionid, IDS.datacallid)
    ).toBeNull()
    expect(localStorage.getItem(EXPECTED_KEY)).toBeNull()
  })

  it('returns null when the stored value is malformed JSON', async () => {
    localStorage.setItem(EXPECTED_KEY, 'not-json{{{')
    expect(
      await loadDraft(USER, IDS.fismasystemid, IDS.functionid, IDS.datacallid)
    ).toBeNull()
  })

  it('evicts the entry when the stored value is malformed JSON', async () => {
    localStorage.setItem(EXPECTED_KEY, 'not-json{{{')
    await loadDraft(USER, IDS.fismasystemid, IDS.functionid, IDS.datacallid)
    expect(localStorage.getItem(EXPECTED_KEY)).toBeNull()
  })

  it('returns null and evicts when decrypted payload is missing notes', async () => {
    const { iv, ciphertext } = await encryptRaw(keyA, {
      selectQuestionOption: 5,
    })
    localStorage.setItem(
      EXPECTED_KEY,
      JSON.stringify({ v: DRAFT_VERSION, iv, ciphertext, savedAt: Date.now() })
    )

    const result = await loadDraft(
      USER,
      IDS.fismasystemid,
      IDS.functionid,
      IDS.datacallid
    )
    expect(result).toBeNull()
    expect(localStorage.getItem(EXPECTED_KEY)).toBeNull()
  })

  it('returns null and evicts when decrypted payload has wrong field types', async () => {
    const { iv, ciphertext } = await encryptRaw(keyA, {
      selectQuestionOption: 'not-a-number',
      notes: 42,
    })
    localStorage.setItem(
      EXPECTED_KEY,
      JSON.stringify({ v: DRAFT_VERSION, iv, ciphertext, savedAt: Date.now() })
    )

    const result = await loadDraft(
      USER,
      IDS.fismasystemid,
      IDS.functionid,
      IDS.datacallid
    )
    expect(result).toBeNull()
    expect(localStorage.getItem(EXPECTED_KEY)).toBeNull()
  })

  it('does not throw when localStorage.getItem throws', async () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError')
    })
    await expect(
      loadDraft(USER, IDS.fismasystemid, IDS.functionid, IDS.datacallid)
    ).resolves.toBeNull()
  })
})

describe('clearDraft', () => {
  it('removes the entry at the correct key', async () => {
    await saveDraft(
      USER,
      IDS.fismasystemid,
      IDS.functionid,
      IDS.datacallid,
      DRAFT
    )
    await clearDraft(USER, IDS.fismasystemid, IDS.functionid, IDS.datacallid)
    expect(localStorage.getItem(EXPECTED_KEY)).toBeNull()
  })

  it('does not throw when the key does not exist', async () => {
    await expect(
      clearDraft(USER, IDS.fismasystemid, IDS.functionid, IDS.datacallid)
    ).resolves.not.toThrow()
  })

  it('does not throw when localStorage.removeItem throws', async () => {
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('SecurityError')
    })
    await expect(
      clearDraft(USER, IDS.fismasystemid, IDS.functionid, IDS.datacallid)
    ).resolves.not.toThrow()
  })

  it('only removes the targeted key, leaving others intact', async () => {
    await saveDraft(USER, 1, 2, 3, DRAFT)
    await saveDraft(USER, 1, 2, 4, DRAFT)
    await clearDraft(USER, 1, 2, 3)
    expect(localStorage.getItem(`ztmf_draft_${H_USER}_1_2_3`)).toBeNull()
    expect(localStorage.getItem(`ztmf_draft_${H_USER}_1_2_4`)).not.toBeNull()
  })
})

describe('clearOtherUserDrafts', () => {
  it('removes drafts belonging to other users', async () => {
    await saveDraft(USER_A, 1, 2, 3, DRAFT)
    await saveDraft(USER_B, 1, 2, 3, DRAFT)
    await clearOtherUserDrafts(USER_A)
    expect(localStorage.getItem(`ztmf_draft_${H_USER_A}_1_2_3`)).not.toBeNull()
    expect(localStorage.getItem(`ztmf_draft_${H_USER_B}_1_2_3`)).toBeNull()
  })

  it('preserves all drafts belonging to the current user', async () => {
    await saveDraft(USER_A, 1, 2, 3, DRAFT)
    await saveDraft(USER_A, 1, 2, 4, DRAFT)
    await clearOtherUserDrafts(USER_A)
    expect(localStorage.getItem(`ztmf_draft_${H_USER_A}_1_2_3`)).not.toBeNull()
    expect(localStorage.getItem(`ztmf_draft_${H_USER_A}_1_2_4`)).not.toBeNull()
  })

  it('does not remove unrelated localStorage keys', async () => {
    localStorage.setItem('some_other_key', 'value')
    await saveDraft(USER_B, 1, 2, 3, DRAFT)
    await clearOtherUserDrafts(USER_A)
    expect(localStorage.getItem('some_other_key')).toBe('value')
  })

  it('does nothing when userid is empty', async () => {
    await saveDraft(USER_A, 1, 2, 3, DRAFT)
    await clearOtherUserDrafts('')
    expect(localStorage.getItem(`ztmf_draft_${H_USER_A}_1_2_3`)).not.toBeNull()
  })

  it('does not throw when localStorage throws', async () => {
    jest.spyOn(Storage.prototype, 'key').mockImplementation(() => {
      throw new DOMException('SecurityError')
    })
    await expect(clearOtherUserDrafts(USER_A)).resolves.not.toThrow()
  })
})

// Minimal in-memory IndexedDB for the device-key store. jsdom has no IndexedDB,
// and the rest of this suite deliberately bypasses it via __setKeyForTesting, so
// this stand-in lets the real getOrCreateDeviceKey path run for the concurrency
// regression below. It stores values by reference (a CryptoKey round-trips
// unchanged, as the browser's structured clone keeps it usable) and fires
// callbacks on a later microtask so concurrent callers interleave the way they
// would against a real database.
type FakeRequest = {
  result?: unknown
  onsuccess?: (ev: { target: FakeRequest }) => void
  onupgradeneeded?: (ev: { target: FakeRequest }) => void
}

function installMemoryIndexedDB(): () => void {
  const stores = new Map<string, Map<IDBValidKey, unknown>>()
  let created = false
  const settle = (req: FakeRequest, result?: unknown) => {
    queueMicrotask(() => {
      req.result = result
      req.onsuccess?.({ target: req })
    })
  }
  const storeFor = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map())
    const data = stores.get(name)!
    return {
      get(key: IDBValidKey) {
        const req: FakeRequest = {}
        settle(req, data.get(key))
        return req
      },
      put(value: unknown, key: IDBValidKey) {
        const req: FakeRequest = {}
        data.set(key, value)
        settle(req, key)
        return req
      },
    }
  }
  const db = {
    createObjectStore: (name: string) => storeFor(name),
    transaction: (name: string) => ({ objectStore: () => storeFor(name) }),
    close: () => {},
  }
  const fake = {
    open() {
      const req: FakeRequest = {}
      queueMicrotask(() => {
        req.result = db
        if (!created) {
          created = true
          req.onupgradeneeded?.({ target: req })
        }
        req.onsuccess?.({ target: req })
      })
      return req
    },
    deleteDatabase() {
      stores.clear()
      created = false
      const req: FakeRequest = {}
      settle(req)
      return req
    },
  }
  const holder = globalThis as { indexedDB?: unknown }
  const original = holder.indexedDB
  holder.indexedDB = fake as unknown as IDBFactory
  return () => {
    holder.indexedDB = original
  }
}

describe('device key persistence (IndexedDB)', () => {
  const IDB_USER = 'idb-user'
  const SYS = 9
  const DC = 7
  let restoreIndexedDB: () => void

  beforeAll(() => {
    restoreIndexedDB = installMemoryIndexedDB()
  })
  afterAll(() => {
    restoreIndexedDB()
  })

  beforeEach(async () => {
    // Run the real create-key path (not a seeded key): empty the store and both
    // in-memory caches so getOrCreateDeviceKey reaches IndexedDB.
    localStorage.clear()
    __resetKeyCache()
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('ztmf-draft-keys')
      req.onsuccess = () => resolve()
    })
  })

  it('concurrent first-use saves share one key and survive a reload', async () => {
    // Fire concurrent saves for different questions before any key exists, so
    // each save triggers key creation while the others are still resolving.
    // Regression: previously each concurrent caller generated and persisted its
    // own key, orphaning every draft not encrypted with the last-written key —
    // they then failed to decrypt after reload and were silently evicted.
    const fns = [1, 2, 3, 4]
    const results = await Promise.all(
      fns.map((functionid) =>
        saveDraft(IDB_USER, SYS, functionid, DC, {
          selectQuestionOption: functionid,
          notes: `notes ${functionid}`,
        })
      )
    )
    expect(results).toEqual([true, true, true, true])

    // Simulate a reload: in-memory cache is gone, IndexedDB persists. Every draft
    // must still decrypt — i.e. the key that encrypted it is the one persisted.
    __resetKeyCache()
    for (const functionid of fns) {
      await expect(loadDraft(IDB_USER, SYS, functionid, DC)).resolves.toEqual({
        selectQuestionOption: functionid,
        notes: `notes ${functionid}`,
      })
    }
  })

  it('reuses the persisted key across reloads for a returning user', async () => {
    expect(await saveDraft(IDB_USER, SYS, 1, DC, DRAFT)).toBe(true)
    // Reload: cache cleared, the key read back from IndexedDB must decrypt.
    __resetKeyCache()
    await expect(loadDraft(IDB_USER, SYS, 1, DC)).resolves.toEqual(DRAFT)
  })
})
