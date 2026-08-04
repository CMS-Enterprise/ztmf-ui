// Behavioral coverage for the extended-metadata edit controls: the tri-state
// boolean select emits a typed boolean|null, and the cloud dependents lock
// when cloud_system is No. The pure conversion/gating helpers are unit-tested
// in utils/systemMetadataVocab.test.ts; this pins the JSX wiring.

// useSystemAttributes -> axiosConfig reads import.meta.env at load and throws
// under @swc/jest. Swap in a bare axios instance the MockAdapter can drive.
jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: '/api/v1/' }) }
})

import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import SystemDetailEditView from './SystemDetailEditView'
import axiosInstance from '@/axiosConfig'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import type { FismaSystemType } from '@/types'

const mock = new MockAdapter(axiosInstance)
afterEach(() => mock.reset())

const BASE_SYSTEM = {
  fismasystemid: 1,
  fismaname: 'Test System',
  fismaacronym: 'TS',
  fismauid: 'UID-1',
  component: 'CMS',
  datacenterenvironment: 'CMS-Cloud-AWS',
  issoemail: 'isso@example.gov',
  datacallcontact: 'dcc@example.gov',
  decommissioned: false,
  sdl_sync_enabled: null,
  hva: null,
  cloud_system: null,
  cloud_service_model: null,
  cloud_vendor: null,
  legacy: null,
} as unknown as FismaSystemType

/**
 * Renders the edit view with no-op handlers, overriding just the pieces a test
 * cares about. Returns the onFieldChange spy for asserting emitted values.
 */
function renderEditView(
  editedOverrides: Partial<FismaSystemType> = {},
  formValid: Record<string, boolean> = {}
) {
  const onFieldChange = jest.fn()
  const editedSystem = { ...BASE_SYSTEM, ...editedOverrides } as FismaSystemType
  renderWithProviders(
    <SystemDetailEditView
      system={BASE_SYSTEM}
      editedSystem={editedSystem}
      formValid={formValid}
      formValidErrorText={{}}
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

test('optional selects do not render in an error state on a valid form', async () => {
  // A realistic formValid: every required field is valid and the optional
  // extended fields simply have no entry. Optional fields never get a formValid
  // key, so without the `field.required` guard the error check reads
  // !undefined === true and paints them all invalid. An all-valid stand-in
  // would hide exactly that regression.
  mock.onGet('/systemattributes').reply(200, {
    data: [
      {
        field: 'system_type',
        value: 'Major Application',
        selectable: true,
        ordr: 10,
      },
    ],
  })
  const requiredValid = {
    fismaname: true,
    fismaacronym: true,
    fismauid: true,
    component: true,
    datacenterenvironment: true,
    issoemail: true,
    datacallcontact: true,
  }
  renderEditView({ system_type: 'Major Application' }, requiredValid)

  // Wait for the vocabulary fetch so the select renders its chosen value.
  await screen.findByRole('combobox', { name: 'System Type' })
  // No field on a valid form should carry MUI's error styling.
  expect(document.querySelectorAll('.Mui-error')).toHaveLength(0)
})

test('tri-state boolean select emits a typed boolean, not a string', async () => {
  mock.onGet('/systemattributes').reply(200, { data: [] })
  const user = userEvent.setup()
  const { onFieldChange } = renderEditView({ hva: null })

  await user.click(screen.getByRole('combobox', { name: 'HVA' }))
  await user.click(screen.getByRole('option', { name: 'No' }))

  expect(onFieldChange).toHaveBeenCalledWith('hva', false)
})

test('setting the boolean to Unknown emits null (the clear signal)', async () => {
  mock.onGet('/systemattributes').reply(200, { data: [] })
  const user = userEvent.setup()
  const { onFieldChange } = renderEditView({ hva: true })

  await user.click(screen.getByRole('combobox', { name: 'HVA' }))
  await user.click(screen.getByRole('option', { name: 'Unknown' }))

  expect(onFieldChange).toHaveBeenCalledWith('hva', null)
})

test('ISSO Name renders as an editable control with its override guidance', async () => {
  mock.onGet('/systemattributes').reply(200, { data: [] })
  renderEditView({ isso_name: 'Conan Antonio Motti' })

  expect(screen.getByRole('textbox', { name: 'ISSO Name' })).toBeEnabled()
  // The guidance is what tells an admin that a typed name is a permanent
  // override and that clearing returns the derived name.
  expect(
    screen.getByText(/overrides the name from the ISSO's user account/i)
  ).toBeInTheDocument()
})

test('clearing ISSO Name emits the empty-string clear signal', async () => {
  mock.onGet('/systemattributes').reply(200, { data: [] })
  const user = userEvent.setup()
  const { onFieldChange } = renderEditView({ isso_name: 'Conan Antonio Motti' })

  await user.clear(screen.getByRole('textbox', { name: 'ISSO Name' }))

  // '' clears the stored override via blankToNil, restoring the name the
  // backend derives from the ISSO user record; null would leave it unchanged.
  expect(onFieldChange).toHaveBeenCalledWith('isso_name', '')
})

test('cloud dependents are hidden while cloud_system is No', () => {
  mock.onGet('/systemattributes').reply(200, { data: [] })
  renderEditView({ cloud_system: false })

  expect(screen.queryByLabelText('Cloud Vendor')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('combobox', { name: 'Cloud Service Model' })
  ).not.toBeInTheDocument()
})

test('cloud dependents are shown while cloud_system is Yes', () => {
  mock.onGet('/systemattributes').reply(200, { data: [] })
  renderEditView({ cloud_system: true })

  expect(screen.getByLabelText('Cloud Vendor')).toBeInTheDocument()
  expect(
    screen.getByRole('combobox', { name: 'Cloud Service Model' })
  ).toBeInTheDocument()
})
