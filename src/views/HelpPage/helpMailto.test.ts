import { buildHelpMailto, HELP_SUBJECT } from './helpMailto'

describe('buildHelpMailto', () => {
  it('builds an encoded mailto with the subject and site', () => {
    const href = buildHelpMailto(' help@example.gov ', 'ztmf.example.gov')
    expect(href).toMatch(/^mailto:help@example\.gov\?subject=/)
    const params = new URLSearchParams(href!.split('?')[1])
    expect(params.get('subject')).toBe(HELP_SUBJECT)
    expect(params.get('body')).toContain('Site: ztmf.example.gov')
  })

  it.each([
    '',
    '   ',
    'not-an-address',
    'help@example.gov?cc=x@example.gov',
    'help@example.gov,other@example.gov',
    'help@example.gov&bcc=x@example.gov',
    'javascript:alert(1)@example.gov',
    'help#x@example.gov',
    'help%3Fcc%3Dx@example.gov',
    'help/x@example.gov',
  ])('returns null for %p', (email) => {
    expect(buildHelpMailto(email, 'ztmf.example.gov')).toBeNull()
  })
})
