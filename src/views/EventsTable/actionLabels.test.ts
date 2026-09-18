import { actionLabel } from './actionLabels'

describe('actionLabel', () => {
  it('capitalizes the action verb for display', () => {
    expect(actionLabel('created')).toBe('Created')
    expect(actionLabel('updated')).toBe('Updated')
    expect(actionLabel('viewed')).toBe('Viewed')
    expect(actionLabel('imported')).toBe('Imported')
  })

  it('returns an empty string for an empty action', () => {
    expect(actionLabel('')).toBe('')
  })
})
