// Decommission and reactivate flows on the System Details page.
// Both are state-changing writes reached only through the admin edit view - a
// checkbox/button reveals a form, a confirm dialog gates the request, and the
// handler issues a DELETE (decommission) or PUT /reactivate. These were
// uncovered; a regression here silently fails to retire or restore a system.

// axiosConfig reads import.meta.env at module load and throws under @swc/jest.
jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: '/api/v1/' }) }
})
jest.mock('@/utils/notify', () => {
  const actual = jest.requireActual('@/utils/notify')
  return { ...actual, notify: jest.fn() }
})

let mockCtx: Record<string, unknown>
jest.mock('../Title/Context', () => ({
  useContextProp: () => mockCtx,
}))

import { screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import MockAdapter from 'axios-mock-adapter'
import SystemDetailPage from './SystemDetailPage'
import axiosInstance from '@/axiosConfig'
import { STATUS_MESSAGES, ERROR_MESSAGES } from '@/constants'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import type { FismaSystemType, UserRole, userData } from '@/types'

const mock = new MockAdapter(axiosInstance)
const notify = require('@/utils/notify').notify as jest.Mock

// Set the decommission date to an explicit past date. The form defaults it to
// getTodayISO() (the LOCAL calendar date), which validateDecommissionDate then
// parses as UTC midnight and compares against UTC-today; in a UTC+ timezone the
// local date can be a day ahead in UTC and read as "in the future," so relying
// on the default fails there. A fixed past date keeps these tests
// timezone-independent.
function setDecommissionDate(value = '2020-01-01') {
  const input = document.querySelector('input[type="date"]') as HTMLInputElement
  fireEvent.change(input, { target: { value } })
}

const BASE_SYSTEM = {
  fismasystemid: 42,
  fismaname: 'Super Star Destroyer Executor Command Systems',
  fismaacronym: 'SSD-EX',
  fismauid: 'UID-42',
  component: 'CMS',
  datacenterenvironment: 'CMS-Cloud-AWS',
  issoemail: 'admiral.piett@executor.empire',
  datacallcontact: 'captain.needa@executor.empire',
  opdiv_id: 1,
  decommissioned: false,
  sdl_sync_enabled: false,
  isso_name: '',
  hva: null,
  fips: null,
  system_type: null,
  cloud_system: null,
  cloud_service_model: null,
  cloud_vendor: null,
  system_operator: null,
  goco_coco_gogo: null,
  system_owner: null,
  system_owner_email: null,
  legacy: null,
} as unknown as FismaSystemType

beforeEach(() => {
  mock.reset()
  notify.mockClear()
  mock.onGet('/systemattributes').reply(200, { data: [] })
})

function renderPage(system: FismaSystemType, role: UserRole = 'OWNER') {
  mockCtx = {
    fismaSystems: [system],
    setFismaSystems: jest.fn(),
    userInfo: {
      userid: '1',
      email: 'grand.moff@deathstar.empire',
      fullname: 'Grand Moff Tarkin',
      role,
    } as userData,
    datacenterEnvironments: [],
    opdivs: [
      {
        opdiv_id: 1,
        code: 'CMS',
        name: 'CMS',
        is_parent: false,
        active: true,
        system_delegate_enabled: false,
      },
    ],
    fetchFismaSystems: jest.fn().mockResolvedValue(undefined),
    showDecommissioned: false,
  }
  return renderWithProviders(
    <Routes>
      <Route path="/systems/:fismasystemid" element={<SystemDetailPage />} />
    </Routes>,
    { initialEntries: ['/systems/42'] }
  )
}

/** The header Edit button (matched by the CMS design-system class). */
function clickEdit(user: ReturnType<typeof userEvent.setup>) {
  const editBtn = screen
    .queryAllByRole('button', { name: 'Edit' })
    .filter((b) => b.classList.contains('ds-c-button'))[0]
  return user.click(editBtn)
}

test('decommissioning an active system DELETEs with the chosen date, notifies, and updates state', async () => {
  const captured: { body?: Record<string, unknown> } = {}
  mock.onDelete(/fismasystems\/42$/).reply((config) => {
    captured.body = config.data ? JSON.parse(config.data) : undefined
    return [200, {}]
  })
  const user = userEvent.setup()
  const system = BASE_SYSTEM
  renderPage(system)
  const setFismaSystems = mockCtx.setFismaSystems as jest.Mock

  await screen.findByText('System Identity')
  await clickEdit(user)

  await user.click(
    await screen.findByRole('checkbox', { name: /Decommission System/i })
  )
  setDecommissionDate('2020-01-01')
  await user.click(await screen.findByRole('button', { name: 'Decommission' }))
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: /confirm/i }))

  await waitFor(() => expect(captured.body).toBeDefined())
  // The chosen date is sent.
  expect(captured.body).toMatchObject({
    decommissioned_date: '2020-01-01T00:00:00.000Z',
  })
  // The success outcome fires: toast + the system is flipped to
  // decommissioned in shared state (guards against a handler that only calls
  // the API and drops the state update).
  await waitFor(() =>
    expect(notify).toHaveBeenCalledWith(
      STATUS_MESSAGES.systemDecommissioned,
      'success',
      expect.anything()
    )
  )
  expect(setFismaSystems).toHaveBeenCalled()
  const updater = setFismaSystems.mock.calls.at(-1)![0] as (
    prev: FismaSystemType[]
  ) => FismaSystemType[]
  expect(
    updater([system]).find((s) => s.fismasystemid === 42)?.decommissioned
  ).toBe(true)
  // The page leaves edit mode, so the form's Save control is gone.
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'Save' })
    ).not.toBeInTheDocument()
  )
})

test('cancelling the decommission confirmation issues no DELETE', async () => {
  let deleteCalled = false
  mock.onDelete(/fismasystems\/42$/).reply(() => {
    deleteCalled = true
    return [200, {}]
  })
  const user = userEvent.setup()
  renderPage(BASE_SYSTEM)

  await screen.findByText('System Identity')
  await clickEdit(user)
  await user.click(
    await screen.findByRole('checkbox', { name: /Decommission System/i })
  )
  setDecommissionDate('2020-01-01')
  await user.click(await screen.findByRole('button', { name: 'Decommission' }))

  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: /cancel/i }))

  expect(deleteCalled).toBe(false)
  // Cancel is a no-op: no decommission toast either.
  expect(notify).not.toHaveBeenCalledWith(
    STATUS_MESSAGES.systemDecommissioned,
    'success',
    expect.anything()
  )
})

test('reactivating a decommissioned system PUTs /reactivate and notifies', async () => {
  const decommissioned = {
    ...BASE_SYSTEM,
    decommissioned: true,
    decommissioned_date: '2020-01-01T00:00:00.000Z',
  } as unknown as FismaSystemType
  let reactivateCalled = false
  mock.onPut(/fismasystems\/42\/reactivate$/).reply(() => {
    reactivateCalled = true
    return [200, {}]
  })
  const user = userEvent.setup()
  renderPage(decommissioned)
  const setFismaSystems = mockCtx.setFismaSystems as jest.Mock

  await screen.findByText('System Identity')
  await clickEdit(user)

  // A decommissioned system shows Reactivate; opening its form then confirming.
  await user.click(
    await screen.findByRole('button', { name: 'Reactivate System' })
  )
  await user.click(await screen.findByRole('button', { name: 'Reactivate' }))

  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: /confirm/i }))

  await waitFor(() => expect(reactivateCalled).toBe(true))
  // Success outcome: toast + the system is flipped back to active in state.
  await waitFor(() =>
    expect(notify).toHaveBeenCalledWith(
      STATUS_MESSAGES.systemReactivated,
      'success',
      expect.anything()
    )
  )
  const updater = setFismaSystems.mock.calls.at(-1)![0] as (
    prev: FismaSystemType[]
  ) => FismaSystemType[]
  expect(
    updater([decommissioned]).find((s) => s.fismasystemid === 42)
      ?.decommissioned
  ).toBe(false)
})

// ---------------------------------------------------------------------------
// Read-view rendering, decommissioned-by/reactivated-by name resolution, the
// single-system fetch fallback, and the save error path.
// ---------------------------------------------------------------------------

test('resolves decommissioned-by (read view) and reactivated-by (edit view) UUIDs to names', async () => {
  const decommissioned = {
    ...BASE_SYSTEM,
    decommissioned: true,
    decommissioned_date: '2020-01-01T00:00:00.000Z',
    decommissioned_by: 'user-ozzel',
    reactivated_by: 'user-piett',
    reactivated_date: '2019-06-01T00:00:00.000Z',
  } as unknown as FismaSystemType
  mock
    .onGet('/users/user-ozzel')
    .reply(200, { data: { fullname: 'Admiral Ozzel' } })
  mock
    .onGet('/users/user-piett')
    .reply(200, { data: { fullname: 'Admiral Piett' } })
  const user = userEvent.setup()

  renderPage(decommissioned)

  // The read view resolves the decommissioned-by UUID to a name.
  expect(await screen.findByText('Admiral Ozzel')).toBeInTheDocument()
  expect(screen.queryByText('user-ozzel')).not.toBeInTheDocument()

  // The edit view additionally shows the reactivated-by name, so both
  // resolution effects are exercised through their rendered output.
  await clickEdit(user)
  expect(await screen.findByText(/Admiral Piett/)).toBeInTheDocument()
  expect(screen.queryByText(/user-piett/)).not.toBeInTheDocument()
})

test('falls back to a single-system fetch when the system is not in context', async () => {
  let fetchedId: string | undefined
  mock.onGet(/fismasystems\/42$/).reply((config) => {
    fetchedId = config.url
    return [200, { data: { ...BASE_SYSTEM } }]
  })

  // Context holds a different system, so the page fetches id 42 individually.
  const other = {
    ...BASE_SYSTEM,
    fismasystemid: 7,
  } as unknown as FismaSystemType
  mockCtx = {
    fismaSystems: [other],
    setFismaSystems: jest.fn(),
    userInfo: {
      userid: '1',
      email: 'grand.moff@deathstar.empire',
      fullname: 'Grand Moff Tarkin',
      role: 'OWNER',
    } as userData,
    datacenterEnvironments: [],
    opdivs: [
      {
        opdiv_id: 1,
        code: 'CMS',
        name: 'CMS',
        is_parent: false,
        active: true,
        system_delegate_enabled: false,
      },
    ],
    fetchFismaSystems: jest.fn().mockResolvedValue(undefined),
    showDecommissioned: false,
  }
  renderWithProviders(
    <Routes>
      <Route path="/systems/:fismasystemid" element={<SystemDetailPage />} />
    </Routes>,
    { initialEntries: ['/systems/42'] }
  )

  await waitFor(() => expect(fetchedId).toContain('fismasystems/42'))
})

test('a 400 on save routes the field error inline and keeps editing', async () => {
  mock
    .onPut(/fismasystems\/42$/)
    .reply(400, { data: { fismaname: 'FISMA Name is required' } })
  const user = userEvent.setup()
  renderPage(BASE_SYSTEM)

  await screen.findByText('System Identity')
  await clickEdit(user)
  await user.click(await screen.findByRole('button', { name: 'Save' }))

  expect(await screen.findByText('FISMA Name is required')).toBeInTheDocument()
})

test('a 404 on decommission surfaces the system-not-found error', async () => {
  mock.onDelete(/fismasystems\/42$/).reply(404, {})
  const user = userEvent.setup()
  renderPage(BASE_SYSTEM)
  const setFismaSystems = mockCtx.setFismaSystems as jest.Mock

  await screen.findByText('System Identity')
  await clickEdit(user)
  await user.click(
    await screen.findByRole('checkbox', { name: /Decommission System/i })
  )
  setDecommissionDate('2020-01-01')
  await user.click(await screen.findByRole('button', { name: 'Decommission' }))
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: /confirm/i }))

  // The 404 branch surfaces the specific not-found error, not a success or a
  // generic message, and does not touch shared state.
  await waitFor(() =>
    expect(notify).toHaveBeenCalledWith(
      ERROR_MESSAGES.systemNotFound,
      'error',
      expect.anything()
    )
  )
  expect(notify).not.toHaveBeenCalledWith(
    STATUS_MESSAGES.systemDecommissioned,
    'success',
    expect.anything()
  )
  expect(setFismaSystems).not.toHaveBeenCalled()
})

test('a failed reactivate does not exit the decommissioned state', async () => {
  const decommissioned = {
    ...BASE_SYSTEM,
    decommissioned: true,
    decommissioned_date: '2020-01-01T00:00:00.000Z',
  } as unknown as FismaSystemType
  mock.onPut(/fismasystems\/42\/reactivate$/).reply(500, {})
  const user = userEvent.setup()
  renderPage(decommissioned)
  const setFismaSystems = mockCtx.setFismaSystems as jest.Mock

  await screen.findByText('System Identity')
  await clickEdit(user)
  await user.click(
    await screen.findByRole('button', { name: 'Reactivate System' })
  )
  await user.click(await screen.findByRole('button', { name: 'Reactivate' }))
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: /confirm/i }))

  await waitFor(() =>
    expect(mock.history.put.some((r) => /reactivate$/.test(r.url ?? ''))).toBe(
      true
    )
  )
  // A 500 must not report success or flip the system back to active - the
  // guard against a catch that treats failure as success.
  expect(notify).not.toHaveBeenCalledWith(
    STATUS_MESSAGES.systemReactivated,
    'success',
    expect.anything()
  )
  expect(setFismaSystems).not.toHaveBeenCalled()
})

test('toggling data-lake sync in edit mode updates the draft', async () => {
  const user = userEvent.setup()
  renderPage(BASE_SYSTEM)

  await screen.findByText('System Identity')
  await clickEdit(user)
  // The SDL sync toggle drives onSdlSyncToggle on the edited draft.
  const toggle = await screen.findByRole('checkbox', {
    name: /data lake|sdl|sync/i,
  })
  await user.click(toggle)
  // BASE_SYSTEM starts with sync off, so the click flips the draft on.
  expect(toggle).toBeChecked()
})
