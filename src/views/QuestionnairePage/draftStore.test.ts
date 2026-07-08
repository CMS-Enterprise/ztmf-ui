import {
  saveDraft,
  loadDraft,
  clearDraft,
  clearStaleUserDrafts,
  QuestionDraft,
} from './draftStore'

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000

const USER = 'user-abc'
const IDS = { fismasystemid: 1, functionid: 2, datacallid: 3 } as const
const EXPECTED_KEY = 'ztmf_draft_user-abc_1_2_3'
const DRAFT: QuestionDraft = { selectQuestionOption: 5, notes: 'test notes' }

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('key format', () => {
  it('generates ztmf_draft_{userid}_{system}_{function}_{datacall}', async () => {
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
    await saveDraft('user-a', 1, 2, 3, DRAFT)
    await saveDraft('user-b', 1, 2, 3, DRAFT)
    expect(Object.keys(localStorage)).toHaveLength(2)
  })
})

describe('saveDraft', () => {
  it('writes encrypted JSON to the correct key', async () => {
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

  it('does not throw when localStorage is unavailable', async () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })
    await expect(
      saveDraft(USER, IDS.fismasystemid, IDS.functionid, IDS.datacallid, DRAFT)
    ).resolves.not.toThrow()
  })
})

describe('loadDraft', () => {
  it('returns null for a missing key', async () => {
    expect(
      await loadDraft(USER, IDS.fismasystemid, IDS.functionid, IDS.datacallid)
    ).toBeNull()
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
      'user-a',
      IDS.fismasystemid,
      IDS.functionid,
      IDS.datacallid,
      DRAFT
    )
    // Copy user-a ciphertext into user-b key slot to test key isolation
    const raw = localStorage.getItem('ztmf_draft_user-a_1_2_3')!
    localStorage.setItem('ztmf_draft_user-b_1_2_3', raw)
    const result = await loadDraft(
      'user-b',
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

  it('returns null when the stored value is malformed JSON', async () => {
    localStorage.setItem(EXPECTED_KEY, 'not-json{{{')
    expect(
      await loadDraft(USER, IDS.fismasystemid, IDS.functionid, IDS.datacallid)
    ).toBeNull()
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
    clearDraft(USER, IDS.fismasystemid, IDS.functionid, IDS.datacallid)
    expect(localStorage.getItem(EXPECTED_KEY)).toBeNull()
  })

  it('does not throw when the key does not exist', () => {
    expect(() =>
      clearDraft(USER, IDS.fismasystemid, IDS.functionid, IDS.datacallid)
    ).not.toThrow()
  })

  it('does not throw when localStorage.removeItem throws', () => {
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('SecurityError')
    })
    expect(() =>
      clearDraft(USER, IDS.fismasystemid, IDS.functionid, IDS.datacallid)
    ).not.toThrow()
  })

  it('only removes the targeted key, leaving others intact', async () => {
    await saveDraft(USER, 1, 2, 3, DRAFT)
    await saveDraft(USER, 1, 2, 4, DRAFT)
    clearDraft(USER, 1, 2, 3)
    expect(localStorage.getItem('ztmf_draft_user-abc_1_2_3')).toBeNull()
    expect(localStorage.getItem('ztmf_draft_user-abc_1_2_4')).not.toBeNull()
  })
})

describe('clearStaleUserDrafts', () => {
  it('removes drafts belonging to other users', async () => {
    await saveDraft('user-a', 1, 2, 3, DRAFT)
    await saveDraft('user-b', 1, 2, 3, DRAFT)
    clearStaleUserDrafts('user-a')
    expect(localStorage.getItem('ztmf_draft_user-a_1_2_3')).not.toBeNull()
    expect(localStorage.getItem('ztmf_draft_user-b_1_2_3')).toBeNull()
  })

  it('preserves all drafts belonging to the current user', async () => {
    await saveDraft('user-a', 1, 2, 3, DRAFT)
    await saveDraft('user-a', 1, 2, 4, DRAFT)
    clearStaleUserDrafts('user-a')
    expect(localStorage.getItem('ztmf_draft_user-a_1_2_3')).not.toBeNull()
    expect(localStorage.getItem('ztmf_draft_user-a_1_2_4')).not.toBeNull()
  })

  it('does not remove unrelated localStorage keys', async () => {
    localStorage.setItem('some_other_key', 'value')
    await saveDraft('user-b', 1, 2, 3, DRAFT)
    clearStaleUserDrafts('user-a')
    expect(localStorage.getItem('some_other_key')).toBe('value')
  })

  it('does nothing when userid is empty', async () => {
    await saveDraft('user-a', 1, 2, 3, DRAFT)
    clearStaleUserDrafts('')
    expect(localStorage.getItem('ztmf_draft_user-a_1_2_3')).not.toBeNull()
  })

  it('does not throw when localStorage throws', () => {
    jest.spyOn(Storage.prototype, 'key').mockImplementation(() => {
      throw new DOMException('SecurityError')
    })
    expect(() => clearStaleUserDrafts('user-a')).not.toThrow()
  })
})
