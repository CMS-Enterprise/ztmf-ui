import { emailValidator, optionalEmailValidator } from './validators'

describe('emailValidator', () => {
  it('accepts a plain address', () => {
    expect(emailValidator('admiral.piett@executor.empire')).toBe(false)
  })

  it('accepts plus-addressing and other RFC local-part specials', () => {
    // The backend (mail.ParseAddress) stores these, so the form must not reject
    // them on load and freeze an unrelated edit.
    expect(emailValidator('isso+ztmf@agency.gov')).toBe(false)
    expect(emailValidator("o'malley@agency.gov")).toBe(false)
  })

  it('requires a value', () => {
    expect(emailValidator('')).toBe('This field is required')
  })

  it('rejects a malformed address', () => {
    expect(emailValidator('not-an-email')).toBe('Invalid email address')
    expect(emailValidator('missing@tld')).toBe('Invalid email address')
  })
})

describe('optionalEmailValidator', () => {
  it('treats empty as valid', () => {
    expect(optionalEmailValidator('')).toBe(false)
  })

  it('still validates a present value', () => {
    expect(optionalEmailValidator('isso+ztmf@agency.gov')).toBe(false)
    expect(optionalEmailValidator('not-an-email')).toBe('Invalid email address')
  })
})
