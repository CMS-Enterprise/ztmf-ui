export type QuestionDraft = {
  selectQuestionOption: number
  notes: string
}

// Shape written to localStorage — callers only see QuestionDraft.
type StoredDraft = {
  v: number // format version — entries with a mismatched version are evicted
  iv: string
  ciphertext: string
  savedAt: number
}

const DRAFT_VERSION = 1
const DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000 // 14 days
const DRAFT_PREFIX = 'ztmf_draft_'

// IndexedDB database that holds one non-extractable CryptoKey per user.
// Non-extractable keys cannot be exported via JS API — an attacker needs a
// live browser session, not just a disk dump of the profile directory.
const DB_NAME = 'ztmf-draft-keys'
const DB_VERSION = 1
const KEY_STORE = 'keys'

// In-memory caches — avoids round-trips on repeated reads/writes within a session.
const keyCache = new Map<string, CryptoKey>()
const hashedIdCache = new Map<string, string>()

// Exported for test isolation only — clears both in-memory caches.
export function __resetKeyCache(): void {
  keyCache.clear()
  hashedIdCache.clear()
}

// Exported for test isolation only — seeds the key cache directly, bypassing IDB
// (IndexedDB is unavailable in JSDOM).
export function __setKeyForTesting(userid: string, key: CryptoKey): void {
  keyCache.set(userid, key)
}

// Exported for test isolation only — seeds the hash cache with a predictable value.
export function __setHashedIdForTesting(userid: string, hash: string): void {
  hashedIdCache.set(userid, hash)
}

function openKeyDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(KEY_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function getOrCreateDeviceKey(userid: string): Promise<CryptoKey> {
  const cached = keyCache.get(userid)
  if (cached) return cached

  // Hash the userid so the IDB key name is consistent with the localStorage
  // key format and doesn't expose the raw userid in DevTools.
  const idbKey = await hashUserId(userid)
  const db = await openKeyDB()
  try {
    const existing = await new Promise<CryptoKey | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(KEY_STORE, 'readonly')
        const req = tx.objectStore(KEY_STORE).get(idbKey)
        req.onsuccess = () => resolve(req.result as CryptoKey | undefined)
        req.onerror = () => reject(req.error)
      }
    )

    if (existing) {
      keyCache.set(userid, existing)
      return existing
    }

    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false, // non-extractable — cannot be exported as raw bytes via JS
      ['encrypt', 'decrypt']
    )

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(KEY_STORE, 'readwrite')
      const req = tx.objectStore(KEY_STORE).put(key, idbKey)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })

    keyCache.set(userid, key)
    return key
  } finally {
    db.close()
  }
}

// Hashes the userid with SHA-256 and returns the first 16 base64url characters
// (~96 bits). Used as the user segment of localStorage key names so raw user
// IDs are not visible in DevTools on a shared machine.
async function hashUserId(userid: string): Promise<string> {
  const cached = hashedIdCache.get(userid)
  if (cached) return cached

  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(userid)
  )
  const hash = btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
    .slice(0, 16)

  hashedIdCache.set(userid, hash)
  return hash
}

const draftKey = (
  hashedId: string,
  fismasystemid: number,
  functionid: number,
  datacallid: number
) => `${DRAFT_PREFIX}${hashedId}_${fismasystemid}_${functionid}_${datacallid}`

async function encryptDraft(
  key: CryptoKey,
  draft: QuestionDraft
): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = new TextEncoder().encode(JSON.stringify(draft))
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

async function decryptDraft(
  key: CryptoKey,
  iv: string,
  ciphertext: string
): Promise<QuestionDraft> {
  const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0))
  const ciphertextBytes = Uint8Array.from(atob(ciphertext), (c) =>
    c.charCodeAt(0)
  )
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    key,
    ciphertextBytes
  )
  return JSON.parse(new TextDecoder().decode(decrypted)) as QuestionDraft
}

// Returns true when the draft was successfully persisted, false on any failure
// (storage quota, private browsing, crypto unavailable). The caller uses the
// return value to decide whether to show a "saved" or "not saved" indicator.
export const saveDraft = async (
  userid: string,
  fismasystemid: number,
  functionid: number,
  datacallid: number,
  draft: QuestionDraft
): Promise<boolean> => {
  try {
    const hashedId = await hashUserId(userid)
    const key = await getOrCreateDeviceKey(userid)
    const { iv, ciphertext } = await encryptDraft(key, draft)
    const stored: StoredDraft = {
      v: DRAFT_VERSION,
      iv,
      ciphertext,
      savedAt: Date.now(),
    }
    localStorage.setItem(
      draftKey(hashedId, fismasystemid, functionid, datacallid),
      JSON.stringify(stored)
    )
    return true
  } catch {
    return false
  }
}

export const loadDraft = async (
  userid: string,
  fismasystemid: number,
  functionid: number,
  datacallid: number
): Promise<QuestionDraft | null> => {
  try {
    const hashedId = await hashUserId(userid)
    const raw = localStorage.getItem(
      draftKey(hashedId, fismasystemid, functionid, datacallid)
    )
    if (!raw) return null
    const stored = JSON.parse(raw) as StoredDraft
    // Evict entries from a different format version before any other checks.
    if (stored.v !== DRAFT_VERSION) {
      await clearDraft(userid, fismasystemid, functionid, datacallid)
      return null
    }
    if (!stored.savedAt || Date.now() - stored.savedAt > DRAFT_TTL_MS) {
      await clearDraft(userid, fismasystemid, functionid, datacallid)
      return null
    }
    const key = await getOrCreateDeviceKey(userid)
    const draft = await decryptDraft(key, stored.iv, stored.ciphertext)
    // Runtime shape guard — evict and ignore if the decrypted payload doesn't
    // match the expected structure (format migration, bit-flip, schema change).
    if (
      typeof draft?.selectQuestionOption !== 'number' ||
      typeof draft?.notes !== 'string'
    ) {
      await clearDraft(userid, fismasystemid, functionid, datacallid)
      return null
    }
    return draft
  } catch {
    // Evict the corrupt entry so it isn't retried on every question load
    // for the remaining TTL. Ignore secondary storage failures.
    try {
      await clearDraft(userid, fismasystemid, functionid, datacallid)
    } catch {
      // ignore
    }
    return null
  }
}

export const clearDraft = async (
  userid: string,
  fismasystemid: number,
  functionid: number,
  datacallid: number
): Promise<void> => {
  try {
    const hashedId = await hashUserId(userid)
    localStorage.removeItem(
      draftKey(hashedId, fismasystemid, functionid, datacallid)
    )
  } catch {
    // ignore
  }
}

// Removes localStorage draft entries that belong to a different user.
// Called on app mount so a shared-machine login switch doesn't expose one
// user's drafts to another.
export const clearOtherUserDrafts = async (
  currentUserid: string
): Promise<void> => {
  if (!currentUserid) return
  try {
    const hashedId = await hashUserId(currentUserid)
    const userPrefix = `${DRAFT_PREFIX}${hashedId}_`
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(DRAFT_PREFIX) && !key.startsWith(userPrefix)) {
        toRemove.push(key)
      }
    }
    toRemove.forEach((key) => localStorage.removeItem(key))
  } catch {
    // ignore
  }
}
