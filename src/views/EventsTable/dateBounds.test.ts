import { endOfDayISO, startOfDayISO } from './dateBounds'

describe('day bounds', () => {
  it('spans the full local day from first to last millisecond', () => {
    const d = new Date(1991, 5, 30)
    const from = new Date(startOfDayISO(d))
    const to = new Date(endOfDayISO(d))
    expect(from.getHours()).toBe(0)
    expect(from.getMinutes()).toBe(0)
    expect(to.getHours()).toBe(23)
    expect(to.getMinutes()).toBe(59)
    expect(to.getTime() - from.getTime()).toBe(24 * 60 * 60 * 1000 - 1)
  })
})
