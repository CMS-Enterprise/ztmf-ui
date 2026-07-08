export type QuestionDraft = {
  selectQuestionOption: number
  notes: string
}

// Internal shape written to localStorage — callers only see QuestionDraft.
type StoredDraft = QuestionDraft & { savedAt: number }

const DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

const draftKey = (
  fismasystemid: number,
  functionid: number,
  datacallid: number
) => `ztmf_draft_${fismasystemid}_${functionid}_${datacallid}`

export const saveDraft = (
  fismasystemid: number,
  functionid: number,
  datacallid: number,
  draft: QuestionDraft
): void => {
  try {
    const stored: StoredDraft = { ...draft, savedAt: Date.now() }
    localStorage.setItem(
      draftKey(fismasystemid, functionid, datacallid),
      JSON.stringify(stored)
    )
  } catch {
    // localStorage unavailable (private browsing, quota exceeded) — degrade silently
  }
}

export const loadDraft = (
  fismasystemid: number,
  functionid: number,
  datacallid: number
): QuestionDraft | null => {
  try {
    const raw = localStorage.getItem(
      draftKey(fismasystemid, functionid, datacallid)
    )
    if (!raw) return null
    const stored = JSON.parse(raw) as StoredDraft
    if (!stored.savedAt || Date.now() - stored.savedAt > DRAFT_TTL_MS) {
      clearDraft(fismasystemid, functionid, datacallid)
      return null
    }
    const { savedAt: _, ...draft } = stored
    return draft
  } catch {
    return null
  }
}

export const clearDraft = (
  fismasystemid: number,
  functionid: number,
  datacallid: number
): void => {
  try {
    localStorage.removeItem(draftKey(fismasystemid, functionid, datacallid))
  } catch {
    // ignore
  }
}
