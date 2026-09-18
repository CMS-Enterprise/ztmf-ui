import { useCallback, useEffect, useState } from 'react'
import type {
  FismaSystemType,
  FormValidType,
  FormValidHelperText,
} from '@/types'
import { TEXTFIELD_HELPER_TEXT } from '@/constants'
import { EMPTY_SYSTEM } from '../emptySystem'

const REQUIRED_FIELDS: (keyof FormValidType)[] = [
  'issoemail',
  'datacallcontact',
  'fismaname',
  'fismaacronym',
  'datacenterenvironment',
  'component',
  'fismauid',
]

// opdiv_id is required too, but it is a numeric select rather than a text
// input, so it is seeded and validated separately from the string loop.
const ALL_REQUIRED_KEYS = [...REQUIRED_FIELDS, 'opdiv_id']

const INITIAL_VALID: FormValidType = ALL_REQUIRED_KEYS.reduce(
  (acc, key) => ({ ...acc, [key]: false }),
  {} as FormValidType
)

const INITIAL_ERROR_TEXT: FormValidHelperText = ALL_REQUIRED_KEYS.reduce(
  (acc, key) => ({ ...acc, [key]: TEXTFIELD_HELPER_TEXT }),
  {} as FormValidHelperText
)

/**
 * Owns the edit-form state for the FISMA system modal: the working
 * `editedFismaSystem` draft, the seven required-field validity flags,
 * per-field error text, a touched-fields map, and the load gate.
 *
 * Re-seeds on every `(system, open)` transition: when the modal opens
 * with a system, the required-field validity flags reflect whether each
 * field already has a value (so an edit of a complete row enables Save
 * immediately), touched is cleared (no wall of red errors on first
 * paint), and loading is dropped so the form renders.
 *
 * The hook exposes:
 *
 *   - `isFormValid()` - true when every required field is non-empty.
 *   - `showError(key)` - true only when the field has been touched AND
 *     is currently invalid (audit 4.1 - no pre-emptive errors).
 *   - `handleInputChange(e, key)` - one onChange for every text field;
 *     marks touched, updates the draft, and recomputes validity.
 *   - `markFieldError(key, message)` - the three-step pattern used by
 *     handleSave to surface a backend field-error: mark touched + mark
 *     invalid + set the error text.
 *
 * Setters for `editedFismaSystem` and `loading` are returned for the
 * narrow cases the parent still needs to mutate them directly (e.g. an
 * SDL sync toggle that updates a non-required field).
 * @param {FismaSystemType | undefined} system - The system being edited;
 *   undefined for a Create action.
 * @param {boolean} open - The modal's open flag; init only runs when
 *   transitioning open with a system in hand.
 * @returns {{
 *   editedFismaSystem: FismaSystemType,
 *   setEditedFismaSystem: React.Dispatch<React.SetStateAction<FismaSystemType>>,
 *   formValid: FormValidType,
 *   formValidErrorText: FormValidHelperText,
 *   loading: boolean,
 *   setLoading: React.Dispatch<React.SetStateAction<boolean>>,
 *   isFormValid: () => boolean,
 *   showError: (key: keyof FormValidType) => boolean,
 *   handleInputChange: (
 *     e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
 *     key: string
 *   ) => void,
 *   markFieldError: (key: string, message: string) => void,
 *   resetTouched: () => void,
 * }} Form state + setters + helpers.
 */
export function useEditSystemForm(
  system: FismaSystemType | null | undefined,
  open: boolean
) {
  const [editedFismaSystem, setEditedFismaSystem] =
    useState<FismaSystemType>(EMPTY_SYSTEM)
  const [formValid, setFormValid] = useState<FormValidType>(INITIAL_VALID)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [formValidErrorText, setFormValidErrorText] =
    useState<FormValidHelperText>(INITIAL_ERROR_TEXT)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    if (system && open) {
      const seeded = {} as FormValidType
      for (const key of REQUIRED_FIELDS) {
        const value = system[key as keyof FismaSystemType]
        seeded[key] = typeof value === 'string' && value.length > 0
      }
      seeded.opdiv_id = system.opdiv_id != null
      setFormValid((prev) => ({ ...prev, ...seeded }))
      setEditedFismaSystem(system)
      setTouched({})
      setLoading(false)
    }
  }, [system, open])

  const markTouched = useCallback(
    (key: string) => setTouched((prev) => ({ ...prev, [key]: true })),
    []
  )

  const isFormValid = useCallback(
    () => Object.values(formValid).every((v) => v === true),
    [formValid]
  )

  const showError = useCallback(
    (key: keyof FormValidType): boolean =>
      Boolean(touched[key]) && !formValid[key],
    [touched, formValid]
  )

  const handleInputChange = useCallback(
    (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      key: string
    ) => {
      const value = e.target.value
      const valid = value.length > 0
      markTouched(key)
      setEditedFismaSystem((prev) => ({ ...prev, [key]: value }))
      setFormValid((prev) => ({ ...prev, [key]: valid }))
      if (!valid) {
        setFormValidErrorText((prev) => ({
          ...prev,
          [key]: TEXTFIELD_HELPER_TEXT,
        }))
      }
    },
    [markTouched]
  )

  const markFieldError = useCallback(
    (key: string, message: string) => {
      setFormValid((prev) => ({ ...prev, [key]: false }))
      markTouched(key)
      setFormValidErrorText((prev) => ({ ...prev, [key]: message }))
    },
    [markTouched]
  )

  const resetTouched = useCallback(() => setTouched({}), [])

  return {
    editedFismaSystem,
    setEditedFismaSystem,
    formValid,
    setFormValid,
    formValidErrorText,
    setFormValidErrorText,
    loading,
    setLoading,
    isFormValid,
    showError,
    handleInputChange,
    markTouched,
    markFieldError,
    resetTouched,
  }
}
