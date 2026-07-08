import { saveDraft, loadDraft, clearDraft, QuestionDraft } from './draftStore'

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000

const IDS = { fismasystemid: 1, functionid: 2, datacallid: 3 } as const
const EXPECTED_KEY = 'ztmf_draft_1_2_3'
const DRAFT: QuestionDraft = { selectQuestionOption: 5, notes: 'test notes' }

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('key format', () => {
  it('generates ztmf_draft_{system}_{function}_{datacall}', () => {
    saveDraft(IDS.fismasystemid, IDS.functionid, IDS.datacallid, DRAFT)
    expect(localStorage.getItem(EXPECTED_KEY)).not.toBeNull()
  })

  it('different IDs produce different keys', () => {
    saveDraft(1, 2, 3, DRAFT)
    saveDraft(1, 2, 4, DRAFT)
    expect(Object.keys(localStorage)).toHaveLength(2)
  })
})

describe('saveDraft', () => {
  it('writes JSON to the correct key', () => {
    saveDraft(IDS.fismasystemid, IDS.functionid, IDS.datacallid, DRAFT)
    const raw = localStorage.getItem(EXPECTED_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed.selectQuestionOption).toBe(5)
    expect(parsed.notes).toBe('test notes')
  })

  it('includes a numeric savedAt timestamp', () => {
    const before = Date.now()
    saveDraft(IDS.fismasystemid, IDS.functionid, IDS.datacallid, DRAFT)
    const after = Date.now()
    const { savedAt } = JSON.parse(localStorage.getItem(EXPECTED_KEY)!)
    expect(typeof savedAt).toBe('number')
    expect(savedAt).toBeGreaterThanOrEqual(before)
    expect(savedAt).toBeLessThanOrEqual(after)
  })

  it('does not expose savedAt to the QuestionDraft type (internal only)', () => {
    saveDraft(IDS.fismasystemid, IDS.functionid, IDS.datacallid, DRAFT)
    // loadDraft strips savedAt before returning
    const result = loadDraft(IDS.fismasystemid, IDS.functionid, IDS.datacallid)
    expect(result).not.toHaveProperty('savedAt')
  })

  it('does not throw when localStorage is unavailable', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })
    expect(() =>
      saveDraft(IDS.fismasystemid, IDS.functionid, IDS.datacallid, DRAFT)
    ).not.toThrow()
  })
})

describe('loadDraft', () => {
  it('returns null for a missing key', () => {
    expect(
      loadDraft(IDS.fismasystemid, IDS.functionid, IDS.datacallid)
    ).toBeNull()
  })

  it('returns the draft fields (without savedAt) for a valid fresh entry', () => {
    saveDraft(IDS.fismasystemid, IDS.functionid, IDS.datacallid, DRAFT)
    const result = loadDraft(IDS.fismasystemid, IDS.functionid, IDS.datacallid)
    expect(result).toEqual(DRAFT)
  })

  it('returns null and removes the key when the entry is older than 14 days', () => {
    const savedAt = 1000
    localStorage.setItem(EXPECTED_KEY, JSON.stringify({ ...DRAFT, savedAt }))
    jest.spyOn(Date, 'now').mockReturnValue(savedAt + FOURTEEN_DAYS_MS + 1)

    expect(
      loadDraft(IDS.fismasystemid, IDS.functionid, IDS.datacallid)
    ).toBeNull()
    expect(localStorage.getItem(EXPECTED_KEY)).toBeNull()
  })

  it('returns a valid draft exactly at the TTL boundary (not yet expired)', () => {
    const savedAt = 1000
    localStorage.setItem(EXPECTED_KEY, JSON.stringify({ ...DRAFT, savedAt }))
    jest.spyOn(Date, 'now').mockReturnValue(savedAt + FOURTEEN_DAYS_MS)

    expect(
      loadDraft(IDS.fismasystemid, IDS.functionid, IDS.datacallid)
    ).toEqual(DRAFT)
  })

  it('returns null and removes the key when savedAt is missing (pre-TTL entry)', () => {
    localStorage.setItem(EXPECTED_KEY, JSON.stringify(DRAFT))
    expect(
      loadDraft(IDS.fismasystemid, IDS.functionid, IDS.datacallid)
    ).toBeNull()
    expect(localStorage.getItem(EXPECTED_KEY)).toBeNull()
  })

  it('returns null and removes the key when savedAt is 0', () => {
    localStorage.setItem(EXPECTED_KEY, JSON.stringify({ ...DRAFT, savedAt: 0 }))
    expect(
      loadDraft(IDS.fismasystemid, IDS.functionid, IDS.datacallid)
    ).toBeNull()
    expect(localStorage.getItem(EXPECTED_KEY)).toBeNull()
  })

  it('returns null when the stored value is malformed JSON', () => {
    localStorage.setItem(EXPECTED_KEY, 'not-json{{{')
    expect(
      loadDraft(IDS.fismasystemid, IDS.functionid, IDS.datacallid)
    ).toBeNull()
  })

  it('does not throw when localStorage.getItem throws', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError')
    })
    expect(() =>
      loadDraft(IDS.fismasystemid, IDS.functionid, IDS.datacallid)
    ).not.toThrow()
    expect(
      loadDraft(IDS.fismasystemid, IDS.functionid, IDS.datacallid)
    ).toBeNull()
  })
})

describe('clearDraft', () => {
  it('removes the entry at the correct key', () => {
    saveDraft(IDS.fismasystemid, IDS.functionid, IDS.datacallid, DRAFT)
    clearDraft(IDS.fismasystemid, IDS.functionid, IDS.datacallid)
    expect(localStorage.getItem(EXPECTED_KEY)).toBeNull()
  })

  it('does not throw when the key does not exist', () => {
    expect(() =>
      clearDraft(IDS.fismasystemid, IDS.functionid, IDS.datacallid)
    ).not.toThrow()
  })

  it('does not throw when localStorage.removeItem throws', () => {
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('SecurityError')
    })
    expect(() =>
      clearDraft(IDS.fismasystemid, IDS.functionid, IDS.datacallid)
    ).not.toThrow()
  })

  it('only removes the targeted key, leaving others intact', () => {
    saveDraft(1, 2, 3, DRAFT)
    saveDraft(1, 2, 4, DRAFT)
    clearDraft(1, 2, 3)
    expect(localStorage.getItem('ztmf_draft_1_2_3')).toBeNull()
    expect(localStorage.getItem('ztmf_draft_1_2_4')).not.toBeNull()
  })
})
