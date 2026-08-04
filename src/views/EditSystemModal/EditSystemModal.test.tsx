// Coverage for the Add/Edit modal shell plus its extended-metadata clearing.
// The key regression: picking "None" on an enum select must persist as an
// empty string (the backend's blankToNil clears on '' and treats null as
// "leave unchanged"), and the save must send a dirty-diff of only the changed
// fields.
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import type { FismaSystemType } from '@/types'

jest.mock('@/router/router', () => ({
  __esModule: true,
  default: { navigate: jest.fn() },
}))
// axiosConfig reads import.meta.env at module load and throws under @swc/jest.
// Swap in a bare axios instance the MockAdapter can drive.
jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: '/api/v1/' }) }
})
jest.mock('@/utils/notify', () => ({
  isAuthHandled: jest.fn().mockReturnValue(false),
  notify: jest.fn(),
}))
// SdlSyncToggle hits its own fetch on mount; stub it so the modal renders
// without that side effect contaminating the suite. The toggle's own
// behavior is covered by its sibling component tests.
jest.mock('@/components/SdlSyncToggle/SdlSyncToggle', () => ({
  __esModule: true,
  default: () => null,
}))

import axiosInstance from '@/axiosConfig'
import { notify } from '@/utils/notify'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import EditSystemModal from './EditSystemModal'

const mock = new MockAdapter(axiosInstance)
const notifyMock = notify as jest.Mock

const completeSystem: FismaSystemType = {
  fismasystemid: 7,
  fismaname: 'Imperial Star Destroyer',
  fismaacronym: 'ISD',
  fismauid: 'ISD-001',
  component: 'Operations',
  datacenterenvironment: 'on-prem',
  datacallcontact: 'han@empire.gov',
  issoemail: 'leia@empire.gov',
  groupacronym: 'IMP',
  groupname: 'Imperial Fleet',
  divisionname: 'Death Star Division',
  fismasubsystem: '',
  decommissioned: false,
  // Required since the owning-OpDiv selector landed; without it the seeded
  // formValid.opdiv_id stays false and Save renders disabled.
  opdiv_id: 5,
} as FismaSystemType

const decommissionedSystem: FismaSystemType = {
  ...completeSystem,
  fismasystemid: 9,
  fismaname: 'Death Star',
  fismaacronym: 'DS',
  decommissioned: true,
  decommissioned_date: '2025-01-15T00:00:00.000Z',
  decommissioned_by: 'rebel-1',
  decommissioned_notes: 'Yavin incident',
} as FismaSystemType

beforeEach(() => {
  mock.reset()
  notifyMock.mockClear()
  // The modal fetches the OpDiv reference list on open and the extended
  // section fetches the attribute vocabulary; bare responses keep both quiet.
  mock.onGet('/opdivs').reply(200, { data: [{ opdiv_id: 1, name: 'CMS' }] })
  mock.onGet('/systemattributes').reply(200, { data: [] })
})

describe('EditSystemModal', () => {
  test('renders the Extended Metadata section on create', async () => {
    renderWithProviders(
      <EditSystemModal
        title="Add"
        open
        onClose={jest.fn()}
        system={completeSystem}
        mode="create"
      />
    )
    expect(await screen.findByText('Extended Metadata')).toBeInTheDocument()
    expect(screen.getByText('ISSO Name')).toBeInTheDocument()
    expect(screen.getByText('GOCO/COCO/GOGO')).toBeInTheDocument()
  })

  test('renders nothing while loading=true (open w/o system)', () => {
    renderWithProviders(
      <EditSystemModal
        title="Edit"
        open
        onClose={jest.fn()}
        system={null}
        mode="edit"
      />
    )
    // No modal title visible - the early `open && system` guard returned
    // null before reaching the Modal shell.
    expect(screen.queryByText(/edit fisma system/i)).not.toBeInTheDocument()
  })

  test('renders the form for an existing system in edit mode', async () => {
    renderWithProviders(
      <EditSystemModal
        title="Edit"
        open
        onClose={jest.fn()}
        system={completeSystem}
        mode="edit"
      />
    )
    expect(await screen.findByText('Edit FISMA system')).toBeInTheDocument()
    expect(
      screen.getByDisplayValue('Imperial Star Destroyer')
    ).toBeInTheDocument()
    expect(screen.getByDisplayValue('ISD')).toBeInTheDocument()
    expect(screen.getByDisplayValue('han@empire.gov')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /save changes/i })
    ).toBeInTheDocument()
  })

  test('Save changes submits a PUT and notifies on success', async () => {
    mock.onPut('fismasystems/7').reply(200, { data: completeSystem })
    const onClose = jest.fn()
    renderWithProviders(
      <EditSystemModal
        title="Edit"
        open
        onClose={onClose}
        system={completeSystem}
        mode="edit"
      />
    )
    await screen.findByText('Edit FISMA system')

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(mock.history.put).toHaveLength(1))
    expect(mock.history.put[0].url).toBe('fismasystems/7')
    expect(notifyMock).toHaveBeenCalledWith(
      'Saved',
      'success',
      expect.any(Object)
    )
    expect(onClose).toHaveBeenCalled()
  })

  test('decommissioned system shows the panel + Edit / Reactivate buttons', async () => {
    // Two GET /users/{id} calls fire from useUserNameLookup (decommissioned_by
    // and reactivated_by); answer the first, no-op the second since this row
    // has no reactivation history.
    mock.onGet('users/rebel-1').reply(200, { data: { fullname: 'Luke S' } })

    renderWithProviders(
      <EditSystemModal
        title="Edit"
        open
        onClose={jest.fn()}
        system={decommissionedSystem}
        mode="edit"
      />
    )
    expect(await screen.findByText('System Decommissioned')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /edit decommission details/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /reactivate system/i })
    ).toBeInTheDocument()
  })

  test('Reactivate System button opens the reactivate sub-form', async () => {
    mock.onGet('users/rebel-1').reply(200, { data: { fullname: 'Luke S' } })

    renderWithProviders(
      <EditSystemModal
        title="Edit"
        open
        onClose={jest.fn()}
        system={decommissionedSystem}
        mode="edit"
      />
    )
    await screen.findByText('System Decommissioned')

    await userEvent.click(
      screen.getByRole('button', { name: /reactivate system/i })
    )

    expect(
      screen.getByText(/reactivation notes \(optional\)/i)
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^reactivate$/i })
    ).toBeInTheDocument()
  })

  test('Decommission toggle opens the decommission sub-form for an active system', async () => {
    renderWithProviders(
      <EditSystemModal
        title="Edit"
        open
        onClose={jest.fn()}
        system={completeSystem}
        mode="edit"
      />
    )
    await screen.findByText('Edit FISMA system')

    // The "Decommission System" checkbox lives in the edit-mode panel for
    // an active system; clicking it reveals the date + notes sub-form with
    // the red destructive primary button.
    await userEvent.click(
      screen.getByRole('checkbox', { name: /decommission system/i })
    )

    expect(screen.getByText(/decommission date/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^decommission$/i })
    ).toBeInTheDocument()
  })
})

describe('EditSystemModal extended-metadata clearing', () => {
  const SYSTEM = {
    fismasystemid: 42,
    fismaname: 'Executor',
    fismaacronym: 'EXEC',
    fismauid: 'UID-42',
    component: 'CMS',
    datacenterenvironment: 'CMS-Cloud-AWS',
    issoemail: 'admiral.piett@executor.empire',
    datacallcontact: 'captain.needa@executor.empire',
    opdiv_id: 1,
    sdl_sync_enabled: false,
    fips: 'Low',
    hva: null,
    cloud_system: null,
    cloud_service_model: null,
    cloud_vendor: null,
    system_operator: null,
    goco_coco_gogo: null,
    system_owner: null,
    system_owner_email: null,
    legacy: null,
  } as unknown as FismaSystemType

  /**
   * Captures the JSON body of the next PUT /fismasystems/42.
   * @returns {{ body?: Record<string, unknown> }} Holder filled on PUT.
   */
  const capturePut = () => {
    const captured: { body?: Record<string, unknown> } = {}
    mock.onPut(/fismasystems\/42$/).reply((config) => {
      captured.body = JSON.parse(config.data)
      return [200, {}]
    })
    return captured
  }

  test('clearing an enum select to None saves an empty string, not null', async () => {
    mock.onGet('/systemattributes').reply(200, {
      data: [
        { field: 'fips', value: 'Low', selectable: true, ordr: 10 },
        { field: 'fips', value: 'High', selectable: true, ordr: 20 },
      ],
    })
    const captured = capturePut()
    const user = userEvent.setup()

    renderWithProviders(
      <EditSystemModal
        title="Edit"
        open
        onClose={jest.fn()}
        system={SYSTEM}
        mode="edit"
        datacenterEnvironments={[]}
      />
    )

    // Clear FIPS: open the select and choose the None option.
    await user.click(
      await screen.findByRole('combobox', { name: 'FIPS Impact Level' })
    )
    await user.click(await screen.findByRole('option', { name: /None/ }))

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(captured.body).toBeDefined())
    // Empty string is the clear signal; null would read as "leave unchanged".
    expect(captured.body).toHaveProperty('fips', '')
  })

  test('an untouched extended field is omitted from the save (dirty-diff)', async () => {
    mock.onGet('/systemattributes').reply(200, {
      data: [{ field: 'fips', value: 'Low', selectable: true, ordr: 10 }],
    })
    const captured = capturePut()
    const user = userEvent.setup()

    renderWithProviders(
      <EditSystemModal
        title="Edit"
        open
        onClose={jest.fn()}
        system={SYSTEM}
        mode="edit"
        datacenterEnvironments={[]}
      />
    )

    await screen.findByRole('combobox', { name: 'FIPS Impact Level' })
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(captured.body).toBeDefined())
    // Nothing was changed, so no extended field should be in the payload.
    expect(captured.body).not.toHaveProperty('fips')
    expect(captured.body).not.toHaveProperty('hva')
    expect(captured.body).not.toHaveProperty('cloud_service_model')
  })

  test('an edited ISSO Name is sent in the save payload', async () => {
    const captured = capturePut()
    const user = userEvent.setup()

    renderWithProviders(
      <EditSystemModal
        title="Edit"
        open
        onClose={jest.fn()}
        system={{ ...SYSTEM, isso_name: 'Conan Antonio Motti' }}
        mode="edit"
        datacenterEnvironments={[]}
      />
    )

    const input = await screen.findByRole('textbox', { name: 'ISSO Name' })
    await user.clear(input)
    await user.type(input, 'Firmus Piett')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(captured.body).toBeDefined())
    expect(captured.body).toHaveProperty('isso_name', 'Firmus Piett')
  })

  test('clearing ISSO Name saves an empty string, which restores the derived name', async () => {
    const captured = capturePut()
    const user = userEvent.setup()

    renderWithProviders(
      <EditSystemModal
        title="Edit"
        open
        onClose={jest.fn()}
        system={{ ...SYSTEM, isso_name: 'Conan Antonio Motti' }}
        mode="edit"
        datacenterEnvironments={[]}
      />
    )

    await user.clear(await screen.findByRole('textbox', { name: 'ISSO Name' }))
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(captured.body).toBeDefined())
    // '' clears the stored override so the name derived from the ISSO user
    // record applies again; null would read as "leave unchanged".
    expect(captured.body).toHaveProperty('isso_name', '')
  })

  test('clearing a free-text field saves an empty string, not null', async () => {
    const captured = capturePut()
    const user = userEvent.setup()

    renderWithProviders(
      <EditSystemModal
        title="Edit"
        open
        onClose={jest.fn()}
        system={{ ...SYSTEM, cloud_vendor: 'AWS' }}
        mode="edit"
        datacenterEnvironments={[]}
      />
    )

    // Cloud Vendor is free text (no email/select branch); clear it and save.
    const input = await screen.findByRole('textbox', { name: 'Cloud Vendor' })
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(captured.body).toBeDefined())
    // '' clears via blankToNil; null would read as "leave unchanged" and the
    // clear would silently no-op.
    expect(captured.body).toHaveProperty('cloud_vendor', '')
  })
})
