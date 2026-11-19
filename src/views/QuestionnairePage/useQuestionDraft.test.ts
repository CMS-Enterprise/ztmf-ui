import { act, renderHook, waitFor } from '@testing-library/react'
import { useQuestionDraft } from './useQuestionDraft'

const saveDraftMock = jest.fn()
const loadDraftMock = jest.fn()
const clearDraftMock = jest.fn()
const hasDeclinedDraftMock = jest.fn()

jest.mock('./draftStore', () => ({
  saveDraft: (...args: unknown[]) => saveDraftMock(...args),
  loadDraft: (...args: unknown[]) => loadDraftMock(...args),
  clearDraft: (...args: unknown[]) => clearDraftMock(...args),
  hasDeclinedDraft: (...args: unknown[]) => hasDeclinedDraftMock(...args),
}))

const ctx = { system: 7, questionId: 3, datacallID: 2 }

const baseArgs = {
  userid: 'u1',
  ...ctx,
  isReadOnly: false,
  loadingQuestion: false,
  selectQuestionOption: 10,
  notes: 'seeded',
  initQuestionChoice: 10,
  initNotes: 'seeded',
}

type Args = typeof baseArgs

const setup = (overrides: Partial<Args> = {}) =>
  renderHook((props: Args) => useQuestionDraft(props), {
    initialProps: { ...baseArgs, ...overrides },
  })

beforeEach(() => {
  jest.useRealTimers()
  saveDraftMock.mockReset().mockResolvedValue(true)
  loadDraftMock.mockReset().mockResolvedValue(null)
  clearDraftMock.mockReset().mockResolvedValue(undefined)
  hasDeclinedDraftMock.mockReset().mockResolvedValue(false)
})

describe('restore', () => {
  it('returns a draft whose option is still offered and marks it restored', async () => {
    const stored = { selectQuestionOption: 11, notes: 'mine' }
    loadDraftMock.mockResolvedValue(stored)
    const { result } = setup()
    let out: unknown
    await act(async () => {
      out = await result.current.restore(
        ctx,
        [10, 11],
        new AbortController().signal
      )
    })
    expect(out).toEqual(stored)
    expect(result.current.status).toBe('restored')
  })

  it('returns a notes-only draft regardless of the options', async () => {
    const stored = { selectQuestionOption: -1, notes: 'just notes' }
    loadDraftMock.mockResolvedValue(stored)
    const { result } = setup()
    let out: unknown
    await act(async () => {
      out = await result.current.restore(
        ctx,
        [10],
        new AbortController().signal
      )
    })
    expect(out).toEqual(stored)
    expect(result.current.status).toBe('restored')
  })

  it('evicts a draft that names an option no longer offered', async () => {
    loadDraftMock.mockResolvedValue({ selectQuestionOption: 99, notes: 'x' })
    const { result } = setup()
    let out: unknown
    await act(async () => {
      out = await result.current.restore(
        ctx,
        [10, 11],
        new AbortController().signal
      )
    })
    expect(out).toBeNull()
    expect(clearDraftMock).toHaveBeenCalledWith('u1', 7, 3, 2)
    expect(result.current.status).toBe('idle')
  })

  it('returns undefined when the load is aborted mid-flight', async () => {
    const controller = new AbortController()
    loadDraftMock.mockImplementation(async () => {
      controller.abort()
      return { selectQuestionOption: 10, notes: 'late' }
    })
    const { result } = setup()
    let out: unknown = 'unset'
    await act(async () => {
      out = await result.current.restore(ctx, [10], controller.signal)
    })
    expect(out).toBeUndefined()
    expect(result.current.status).toBe('idle')
  })

  it('evicts instead of loading for a read-only session', async () => {
    const { result } = setup({ isReadOnly: true })
    let out: unknown
    await act(async () => {
      out = await result.current.restore(
        ctx,
        [10],
        new AbortController().signal
      )
    })
    expect(out).toBeNull()
    expect(loadDraftMock).not.toHaveBeenCalled()
    expect(clearDraftMock).toHaveBeenCalledWith('u1', 7, 3, 2)
  })
})

describe('autosave', () => {
  it('saves an edit after the debounce and reports saved', async () => {
    jest.useFakeTimers()
    const { result } = setup({ notes: 'edited' })
    await act(async () => {
      jest.advanceTimersByTime(1000)
    })
    expect(saveDraftMock).toHaveBeenCalledWith(
      'u1',
      7,
      3,
      2,
      { selectQuestionOption: 10, notes: 'edited' },
      expect.any(Function)
    )
    await waitFor(() => expect(result.current.status).toBe('saved'))
  })

  it('drops a pending save when the draft is cleared first', async () => {
    jest.useFakeTimers()
    const { result } = setup({ notes: 'edited' })
    act(() => result.current.clear())
    await act(async () => {
      jest.advanceTimersByTime(1000)
    })
    expect(saveDraftMock).not.toHaveBeenCalled()
    expect(clearDraftMock).toHaveBeenCalledWith('u1', 7, 3, 2)
  })

  it('flushes an unsaved edit on unmount', () => {
    jest.useFakeTimers()
    const { unmount } = setup({ notes: 'edited' })
    unmount()
    expect(saveDraftMock).toHaveBeenCalledWith('u1', 7, 3, 2, {
      selectQuestionOption: 10,
      notes: 'edited',
    })
  })

  it('does not flush on unmount after invalidatePending', () => {
    jest.useFakeTimers()
    const { result, unmount } = setup({ notes: 'edited' })
    act(() => result.current.invalidatePending())
    unmount()
    expect(saveDraftMock).not.toHaveBeenCalled()
  })
})
