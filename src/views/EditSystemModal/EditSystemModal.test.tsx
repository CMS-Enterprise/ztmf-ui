import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import type { FismaSystemType } from '@/types'

jest.mock('@/router/router', () => ({
  __esModule: true,
  default: { navigate: jest.fn() },
}))
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
})

describe('EditSystemModal', () => {
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
