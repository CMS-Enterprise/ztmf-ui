// Coverage for the extended-metadata selects on the system detail edit view
// (ztmf-ui#460). The canonical vocab is served locally by
// useSystemMetadataVocab (stopgap until ztmf#433), so only axios needs a stub.

// The view imports dataCenterEnvironments -> axiosConfig, whose import.meta
// line jest can't parse; stub it (no requests are made in these tests).
jest.mock('@/axiosConfig', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}))

import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SystemDetailEditView from './SystemDetailEditView'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import type {
  FismaSystemType,
  FormValidType,
  FormValidHelperText,
} from '@/types'

// Any field reads valid so the test focuses on select behavior, not error UI.
const allValid = new Proxy({}, { get: () => true }) as unknown as FormValidType
const noErrors = new Proxy(
  {},
  { get: () => '' }
) as unknown as FormValidHelperText

function renderEdit(overrides: Partial<FismaSystemType> = {}) {
  const edited = {
    fismasystemid: 1,
    fismaname: 'Test System',
    fismaacronym: 'TS',
    fismauid: 'uid',
    component: 'C',
    datacenterenvironment: 'AWS',
    decommissioned: false,
    sdl_sync_enabled: null,
    system_type: 'Enterprise',
    cloud_service_model: 'IaaS/PaaS',
    legacy: 'Maybe', // deliberately non-canonical (legacy value)
    ...overrides,
  } as unknown as FismaSystemType

  const onFieldChange = jest.fn()
  renderWithProviders(
    <SystemDetailEditView
      system={edited}
      editedSystem={edited}
      formValid={allValid}
      formValidErrorText={noErrors}
      decommissionDate=""
      decommissionDateError=""
      decommissionNotes=""
      showDecommissionForm={false}
      decommissionedByName=""
      reactivationNotes=""
      showReactivateForm={false}
      reactivatedByName=""
      onInputChange={jest.fn()}
      onFieldChange={onFieldChange}
      onValidatedFieldChange={jest.fn()}
      onDecommissionDateChange={jest.fn()}
      onDecommissionNotesChange={jest.fn()}
      onShowDecommissionForm={jest.fn()}
      onDecommissionRequest={jest.fn()}
      onReactivationNotesChange={jest.fn()}
      onShowReactivateForm={jest.fn()}
      onReactivateRequest={jest.fn()}
      validateDecommissionDate={jest.fn()}
      onSdlSyncToggle={jest.fn()}
      datacenterEnvironments={[]}
      opdivName="CMS"
    />
  )
  return { onFieldChange }
}

test('a canonical field renders as a select showing its current value', () => {
  renderEdit()
  const systemType = screen.getByRole('combobox', { name: /system type/i })
  expect(systemType).toHaveTextContent('Enterprise')
})

test('a legacy value not in the canon is preserved in the select', () => {
  renderEdit()
  // "Maybe" is not a canonical legacy value but must still display.
  expect(screen.getByRole('combobox', { name: /^legacy/i })).toHaveTextContent(
    'Maybe'
  )
})

test('cloud_service_model renders as a multi-select showing its parts', () => {
  renderEdit()
  const model = screen.getByRole('combobox', {
    name: /cloud service model/i,
  })
  expect(model).toHaveTextContent(/IaaS/)
  expect(model).toHaveTextContent(/PaaS/)
})

test('picking a canonical option fires onFieldChange with the value', async () => {
  const user = userEvent.setup()
  const { onFieldChange } = renderEdit()

  await user.click(screen.getByRole('combobox', { name: /system type/i }))
  await user.click(await screen.findByRole('option', { name: 'Local' }))

  expect(onFieldChange).toHaveBeenCalledWith('system_type', 'Local')
})
