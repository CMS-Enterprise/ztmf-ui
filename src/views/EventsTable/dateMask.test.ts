import { endOfDayISO, maskUSDate, parseUSDate, startOfDayISO } from './dateMask'

describe('maskUSDate', () => {
  it('inserts slashes as digits accumulate', () => {
    expect(maskUSDate('0')).toBe('0')
    expect(maskUSDate('06')).toBe('06')
    expect(maskUSDate('063')).toBe('06/3')
    expect(maskUSDate('0630')).toBe('06/30')
    expect(maskUSDate('06301')).toBe('06/30/1')
    expect(maskUSDate('06301991')).toBe('06/30/1991')
  })

  it('re-derives from digits so deleting a trailing slash sticks', () => {
    // The field holds "06/" and the user backspaces: the input event carries
    // "06", and remasking must not immediately restore the slash.
    expect(maskUSDate('06')).toBe('06')
    expect(maskUSDate('06/30')).toBe('06/30')
  })

  it('strips non-digits and caps at eight digits', () => {
    expect(maskUSDate('06/30/1991')).toBe('06/30/1991')
    expect(maskUSDate('6a3b')).toBe('63')
    expect(maskUSDate('063019912345')).toBe('06/30/1991')
  })
})

describe('parseUSDate', () => {
  it('parses a complete valid date', () => {
    const d = parseUSDate('06/30/1991')
    expect(d).not.toBeNull()
    expect(d?.getFullYear()).toBe(1991)
    expect(d?.getMonth()).toBe(5)
    expect(d?.getDate()).toBe(30)
  })

  it('rejects partial input', () => {
    expect(parseUSDate('')).toBeNull()
    expect(parseUSDate('06/30')).toBeNull()
    expect(parseUSDate('06/30/199')).toBeNull()
  })

  it('rejects impossible calendar dates instead of rolling them over', () => {
    expect(parseUSDate('02/30/2026')).toBeNull()
    expect(parseUSDate('13/01/2026')).toBeNull()
    expect(parseUSDate('00/10/2026')).toBeNull()
  })

  it('accepts leap day only in leap years', () => {
    expect(parseUSDate('02/29/2024')).not.toBeNull()
    expect(parseUSDate('02/29/2025')).toBeNull()
  })
})

describe('day bounds', () => {
  it('spans the full local day from first to last millisecond', () => {
    const d = parseUSDate('06/30/1991') as Date
    const from = new Date(startOfDayISO(d))
    const to = new Date(endOfDayISO(d))
    expect(from.getHours()).toBe(0)
    expect(from.getMinutes()).toBe(0)
    expect(to.getHours()).toBe(23)
    expect(to.getMinutes()).toBe(59)
    expect(to.getTime() - from.getTime()).toBe(24 * 60 * 60 * 1000 - 1)
  })
})
