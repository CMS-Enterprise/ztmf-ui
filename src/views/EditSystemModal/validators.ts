// The local part mirrors the characters the backend accepts (Go's
// mail.ParseAddress), so an address the backend already stored can never be
// rejected here and freeze the edit form. Notably this includes '+' for
// plus-addressing. The domain still has to end in a dotted label.
const EMAIL_PATTERN =
  /^[a-zA-Z0-9._:$!%+&'*/=?^`{|}~#-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]+$/

export const emailValidator = (value: string): string | false => {
  if (value.length === 0) {
    return 'This field is required'
  }
  if (!EMAIL_PATTERN.test(value)) return 'Invalid email address'
  return false
}

// For optional email fields: empty is valid; a non-empty value still has to
// be a well-formed address. Required email fields keep using emailValidator.
export const optionalEmailValidator = (value: string): string | false => {
  if (value.length === 0) {
    return false
  }
  return emailValidator(value)
}
