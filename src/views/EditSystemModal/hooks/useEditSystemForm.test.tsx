import { act, renderHook } from '@testing-library/react'
import type { FismaSystemType } from '@/types'
import { useEditSystemForm } from './useEditSystemForm'

// Build a minimal FismaSystemType with every required field populated.
const completeSystem: FismaSystemType = {
  fismasystemid: 1,
  fismaname: 'Imperial Star Destroyer',
  fismaacronym: 'ISD',
  fismauid: 'ISD-001',
  component: 'Operations',
  datacenterenvironment: 'on-prem',
  datacallcontact: 'Han Solo',
  issoemail: 'han@rebellion.gov',
  // FismaSystemType has more optional fields; the hook only reads the
  // seven required ones above.
} as FismaSystemType

function changeEvent(value: string) {
  return {
    target: { value },
  } as React.ChangeEvent<HTMLInputElement>
}

describe('useEditSystemForm', () => {
  test('initial state: not loading=true, formValid all false, isFormValid()=false', () => {
    const { result } = renderHook(() => useEditSystemForm(undefined, false))
    expect(result.current.loading).toBe(true)
    expect(result.current.isFormValid()).toBe(false)
    expect(Object.values(result.current.formValid)).toEqual(
      Array(7).fill(false)
    )
  })

  test('init effect: a complete system unlocks isFormValid() and drops loading', () => {
    const { result } = renderHook(() => useEditSystemForm(completeSystem, true))
    expect(result.current.loading).toBe(false)
    expect(result.current.isFormValid()).toBe(true)
    expect(result.current.editedFismaSystem).toEqual(completeSystem)
  })

  test('init effect: a system missing a required field leaves isFormValid()=false but does not show errors before touch', () => {
    const incomplete = {
      ...completeSystem,
      issoemail: '',
    } as FismaSystemType
    const { result } = renderHook(() => useEditSystemForm(incomplete, true))
    expect(result.current.isFormValid()).toBe(false)
    expect(result.current.formValid.issoemail).toBe(false)
    // showError is gated on `touched` so it stays false on first paint
    // even though the field is invalid (audit 4.1 - no pre-emptive errors).
    expect(result.current.showError('issoemail')).toBe(false)
  })

  test('handleInputChange: typing in a required field marks it touched + valid', () => {
    const { result } = renderHook(() => useEditSystemForm(undefined, false))
    act(() => {
      result.current.handleInputChange(changeEvent('Leia'), 'datacallcontact')
    })
    expect(result.current.formValid.datacallcontact).toBe(true)
    expect(result.current.editedFismaSystem.datacallcontact).toBe('Leia')
    expect(result.current.showError('datacallcontact')).toBe(false)
  })

  test('handleInputChange: blanking a required field marks it invalid AND touched, so showError flips on', () => {
    const { result } = renderHook(() => useEditSystemForm(completeSystem, true))
    act(() => {
      result.current.handleInputChange(changeEvent(''), 'fismaname')
    })
    expect(result.current.formValid.fismaname).toBe(false)
    expect(result.current.showError('fismaname')).toBe(true)
  })

  test('markFieldError: surfaces a backend field error (touched + invalid + message)', () => {
    const { result } = renderHook(() => useEditSystemForm(completeSystem, true))
    act(() => {
      result.current.markFieldError('fismaacronym', 'Acronym already in use')
    })
    expect(result.current.formValid.fismaacronym).toBe(false)
    expect(result.current.showError('fismaacronym')).toBe(true)
    expect(result.current.formValidErrorText.fismaacronym).toBe(
      'Acronym already in use'
    )
  })

  test('resetTouched: clears all touched fields (no errors render until typed)', () => {
    const incomplete = {
      ...completeSystem,
      issoemail: '',
    } as FismaSystemType
    const { result } = renderHook(() => useEditSystemForm(incomplete, true))
    act(() => {
      result.current.handleInputChange(changeEvent(''), 'issoemail')
    })
    expect(result.current.showError('issoemail')).toBe(true)
    act(() => {
      result.current.resetTouched()
    })
    expect(result.current.showError('issoemail')).toBe(false)
  })
})
