import { scoreSortValue } from './scoreHelpers'

describe('scoreSortValue', () => {
  it('sorts a never-assessed system below a genuine zero', () => {
    // "No score row" and "assessed at 0.00" must not collapse to the same value.
    expect(scoreSortValue(undefined)).toBeLessThan(scoreSortValue({ score: 0 }))
  })

  it('returns the numeric score for an assessed system', () => {
    expect(scoreSortValue({ score: 3.5 })).toBe(3.5)
    expect(scoreSortValue({ score: 0 })).toBe(0)
  })
})
