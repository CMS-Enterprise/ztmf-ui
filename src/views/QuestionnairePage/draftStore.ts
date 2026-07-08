export type QuestionDraft = {
  selectQuestionOption: number
  notes: string
}

// Shape written to localStorage — callers only see QuestionDraft.
type StoredDraft = {
  iv: string
  ciphertext: string
  savedAt: number
}

const DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000 // 14 days
const DRAFT_PREFIX = 'ztmf_draft_'
const PBKDF2_SALT = new TextEncoder().encode('ztmf-draft-v1')
const PBKDF2_ITERATIONS = 100_000

const draftKey = (
  userid: string,
  fismasystemid: number,
  functionid: number,
  datacallid: number
) => `${DRAFT_PREFIX}${userid}_${fismasystemid}_${functionid}_${datacallid}`

// Cache derived keys by userid — PBKDF2 is intentionally slow at 100k
// iterations; re-deriving on every read/write would add ~100ms per call.
const keyCache = new Map<string, CryptoKey>()

async function deriveKey(userid: string): Promise<CryptoKey> {
  const cached = keyCache.get(userid)
  if (cached) return cached
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(userid),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: PBKDF2_SALT,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
  keyCache.set(userid, key)
  return key
}

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

export const saveDraft = async (
  userid: string,
  fismasystemid: number,
  functionid: number,
  datacallid: number,
  draft: QuestionDraft
): Promise<void> => {
  try {
    const key = await deriveKey(userid)
    const { iv, ciphertext } = await encryptDraft(key, draft)
    const stored: StoredDraft = { iv, ciphertext, savedAt: Date.now() }
    localStorage.setItem(
      draftKey(userid, fismasystemid, functionid, datacallid),
      JSON.stringify(stored)
    )
  } catch {
    // localStorage unavailable or crypto unsupported — degrade silently
  }
}

export const loadDraft = async (
  userid: string,
  fismasystemid: number,
  functionid: number,
  datacallid: number
): Promise<QuestionDraft | null> => {
  try {
    const raw = localStorage.getItem(
      draftKey(userid, fismasystemid, functionid, datacallid)
    )
    if (!raw) return null
    const stored = JSON.parse(raw) as StoredDraft
    if (!stored.savedAt || Date.now() - stored.savedAt > DRAFT_TTL_MS) {
      clearDraft(userid, fismasystemid, functionid, datacallid)
      return null
    }
    const key = await deriveKey(userid)
    return await decryptDraft(key, stored.iv, stored.ciphertext)
  } catch {
    return null
  }
}

export const clearDraft = (
  userid: string,
  fismasystemid: number,
  functionid: number,
  datacallid: number
): void => {
  try {
    localStorage.removeItem(
      draftKey(userid, fismasystemid, functionid, datacallid)
    )
  } catch {
    // ignore
  }
}

// Removes all drafts in localStorage saved under a different user account.
// Called on app mount so a shared-machine login switch doesn't expose one
// user's notes to another.
export const clearStaleUserDrafts = (currentUserid: string): void => {
  if (!currentUserid) return
  try {
    const userPrefix = `${DRAFT_PREFIX}${currentUserid}_`
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
