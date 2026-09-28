import { resourceLabel } from './resourceLabels'

describe('resourceLabel', () => {
  it('maps known tables to plain nouns', () => {
    expect(resourceLabel('scores')).toBe('Score')
    expect(resourceLabel('users')).toBe('User')
    expect(resourceLabel('fismasystems')).toBe('System')
    expect(resourceLabel('opdivs')).toBe('OpDiv')
  })

  it('names join tables by the membership, not the table', () => {
    expect(resourceLabel('users_fismasystems')).toBe('System assignment')
    expect(resourceLabel('users_opdivs')).toBe('OpDiv grant')
  })

  it('strips a schema qualifier before the lookup', () => {
    expect(resourceLabel('public.scores')).toBe('Score')
  })

  it('prettifies an unknown table instead of showing it raw', () => {
    expect(resourceLabel('audit_log')).toBe('Audit log')
    expect(resourceLabel('public.new_thing')).toBe('New thing')
  })

  it('returns an empty string for an empty type', () => {
    expect(resourceLabel('')).toBe('')
  })
})
