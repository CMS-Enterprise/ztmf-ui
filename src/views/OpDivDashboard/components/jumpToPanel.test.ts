import { HIGHLIGHT_HOLD_MS, jumpToPanel } from './jumpToPanel'

/** A panel element on the page, as the dashboard renders it. */
function mountPanel(id = 'panel') {
  const el = document.createElement('div')
  el.id = id
  el.scrollIntoView = jest.fn()
  document.body.append(el)
  return el
}

beforeEach(() => {
  jest.useFakeTimers()
  document.body.innerHTML = ''
})

afterEach(() => {
  jest.useRealTimers()
})

describe('jumpToPanel', () => {
  it('scrolls the target into view', () => {
    const el = mountPanel()

    jumpToPanel('panel')

    expect(el.scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ block: 'center' })
    )
  })

  it('rings the panel so the reader can see where they landed', () => {
    const el = mountPanel()

    jumpToPanel('panel')

    expect(el.style.boxShadow).not.toBe('')
  })

  it('clears the ring once the hold elapses', () => {
    const el = mountPanel()
    jumpToPanel('panel')

    jest.advanceTimersByTime(HIGHLIGHT_HOLD_MS + 500)

    expect(el.style.boxShadow).toBe('')
    // The inline props are removed rather than left as empty strings, so the
    // panel goes back to being styled entirely by its own component.
    expect(el.getAttribute('style') ?? '').not.toContain('box-shadow')
  })

  it('moves focus to the panel, not just the viewport', () => {
    // A scroll leaves the keyboard caret on the tile, so the next Tab
    // continues through the summary instead of into the panel just opened -
    // and a screen reader is told nothing happened at all.
    const el = mountPanel()

    jumpToPanel('panel')

    expect(document.activeElement).toBe(el)
    expect(el.getAttribute('tabindex')).toBe('-1')
  })

  it('does nothing when the panel is not on the page', () => {
    // Panels are suppressed when they have nothing to report, so a tile can
    // outlive its destination.
    expect(() => jumpToPanel('missing')).not.toThrow()
  })
})
