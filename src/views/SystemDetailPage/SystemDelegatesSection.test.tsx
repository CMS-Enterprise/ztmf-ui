// Coverage for the delegates section on the system detail page
// (ztmf-ui#598). Backend calls are stubbed at the axios boundary so the query
// and mutation hooks in src/utils/delegates run for real, including the
// interceptor bypass on the add call. Verifies the roster + expired badge,
// attach / provision / remove / renew round-trips, the administrator /
// capability-off inline guards, the +3mo expiry default, and that a
// non-manager (ISSM) sees the roster without any controls.

jest.mock('@/router/router', () => ({
  __esModule: true,
  default: { navigate: jest.fn() },
}))

jest.mock('@/utils/notify', () => {
  const actual = jest.requireActual('@/utils/notify')
  return { ...actual, notify: jest.fn() }
})

import MockAdapter from 'axios-mock-adapter'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SystemDelegatesSection from './SystemDelegatesSection'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import { addMonthsISO } from '@/utils/decommission'
import axiosInstance from '@/axiosConfig'
import { apiPaths } from '@/api/keys'
import type { FismaSystemType, DelegateRow, DelegateCandidate } from '@/types'

const mock = new MockAdapter(axiosInstance)

const SYSTEM_ID = 1002
const SYSTEM = { fismasystemid: SYSTEM_ID } as unknown as FismaSystemType
const ROSTER_URL = apiPaths.fismaSystems.delegates(SYSTEM_ID)
const CANDIDATES_URL = apiPaths.fismaSystems.delegateCandidates(SYSTEM_ID)
const delegateUrl = (userid: string) =>
  apiPaths.fismaSystems.delegate(SYSTEM_ID, userid)

const ACTIVE: DelegateRow = {
  userid: 'd-active',
  fullname: 'Active Delegate',
  email: 'active@empire.gov',
  access_expires_at: '2099-12-31T23:59:59Z',
}
const EXPIRED: DelegateRow = {
  userid: 'd-expired',
  fullname: 'Expired Delegate',
  email: 'expired@empire.gov',
  access_expires_at: '2000-01-01T00:00:00Z',
}
const CANDIDATE: DelegateCandidate = {
  userid: 'c-1',
  fullname: 'Wilhuff Tarkin',
  email: 'tarkin@empire.gov',
}

const rosterGets = () => mock.history.get.filter((g) => g.url === ROSTER_URL)
const candidateGets = () =>
  mock.history.get.filter((g) => g.url === CANDIDATES_URL)

function renderSection(canManage = true) {
  return renderWithProviders(
    <SystemDelegatesSection system={SYSTEM} canManage={canManage} />
  )
}

// Handlers match in registration order and a same-matcher reply replaces the
// earlier one, so a test that needs the POST to fail re-registers it with
// reply rather than replyOnce.
beforeEach(() => {
  jest.clearAllMocks()
  mock.reset()
  mock.onGet(ROSTER_URL).reply(200, { data: [ACTIVE, EXPIRED] })
  mock.onGet(CANDIDATES_URL).reply(200, { data: [CANDIDATE] })
  mock.onPost(ROSTER_URL).reply(201)
  mock.onDelete(delegateUrl('d-active')).reply(204)
  mock.onPatch(delegateUrl('d-active')).reply(200, { data: ACTIVE })
})

test('renders the roster with per-row status chips (Active / Expired)', async () => {
  renderSection()

  expect(await screen.findByText('Active Delegate')).toBeInTheDocument()
  const expiredRow = screen.getByText('Expired Delegate').closest('li')!
  expect(within(expiredRow).getByText('Expired')).toBeInTheDocument()
  const activeRow = screen.getByText('Active Delegate').closest('li')!
  expect(within(activeRow).getByText('Active')).toBeInTheDocument()
  expect(within(activeRow).queryByText('Expired')).not.toBeInTheDocument()
})

test('a delegate within 30 days of expiry shows an Expiring soon chip', async () => {
  const soon = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
  mock.onGet(ROSTER_URL).reply(200, {
    data: [
      {
        ...ACTIVE,
        userid: 'd-soon',
        fullname: 'Soon Delegate',
        access_expires_at: soon,
      },
    ],
  })
  renderSection()

  const soonRow = (await screen.findByText('Soon Delegate')).closest('li')!
  expect(within(soonRow).getByText('Expiring soon')).toBeInTheDocument()
})

test('the provision control opens a dialog rather than an inline form', async () => {
  const user = userEvent.setup()
  renderSection()
  await screen.findByText('Active Delegate')

  // No provision form fields until the dialog is opened.
  expect(screen.queryByLabelText(/^name/i)).not.toBeInTheDocument()

  await user.click(
    screen.getByRole('button', { name: /provision new delegate/i })
  )

  const dialog = await screen.findByRole('dialog', {
    name: /provision new delegate/i,
  })
  expect(within(dialog).getByLabelText(/^name/i)).toBeInTheDocument()
  expect(within(dialog).getByLabelText(/^email/i)).toBeInTheDocument()
  expect(within(dialog).getByLabelText(/access expires/i)).toBeInTheDocument()
})

test('an expired candidate carries the same Expired chip as the roster', async () => {
  const user = userEvent.setup()
  mock.onGet(CANDIDATES_URL).reply(200, {
    data: [{ ...CANDIDATE, access_expires_at: '2000-01-01T00:00:00Z' }],
  })
  renderSection()
  await screen.findByText('Active Delegate')

  await user.click(
    screen.getByRole('combobox', { name: /attach an existing delegate/i })
  )
  const option = (await screen.findByText(/Wilhuff Tarkin/i)).closest('li')!
  expect(within(option).getByText('Expired')).toBeInTheDocument()
})

test('an active candidate carries an Active chip', async () => {
  const user = userEvent.setup()
  mock.onGet(CANDIDATES_URL).reply(200, {
    data: [{ ...CANDIDATE, access_expires_at: '2099-12-31T23:59:59Z' }],
  })
  renderSection()
  await screen.findByText('Active Delegate')

  await user.click(
    screen.getByRole('combobox', { name: /attach an existing delegate/i })
  )
  const option = (await screen.findByText(/Wilhuff Tarkin/i)).closest('li')!
  expect(within(option).getByText('Active')).toBeInTheDocument()
  expect(within(option).queryByText('Expired')).not.toBeInTheDocument()
})

test('removing a delegate refreshes the candidate list', async () => {
  // A removed delegate becomes eligible again, so the picker must refetch
  // rather than stay stale until a page reload.
  const user = userEvent.setup()
  renderSection()
  await screen.findByText('Active Delegate')
  await waitFor(() => expect(candidateGets()).toHaveLength(1))

  await user.click(
    screen.getByRole('button', { name: /remove Active Delegate/i })
  )
  await user.click(screen.getByRole('button', { name: /^remove$/i }))

  await waitFor(() => expect(mock.history.delete).toHaveLength(1))
  await waitFor(() => expect(candidateGets()).toHaveLength(2))
})

test('attaching an existing candidate POSTs just the email, bypassing the auth interceptor, and refetches', async () => {
  const user = userEvent.setup()
  renderSection()
  await screen.findByText('Active Delegate')

  await user.click(
    screen.getByRole('combobox', { name: /attach an existing delegate/i })
  )
  const option = await screen.findByText(
    /Wilhuff Tarkin \(tarkin@empire\.gov\)/i
  )
  await user.click(option)

  await waitFor(() => expect(mock.history.post).toHaveLength(1))
  expect(mock.history.post[0].url).toBe(ROSTER_URL)
  expect(JSON.parse(mock.history.post[0].data)).toEqual({
    email: 'tarkin@empire.gov',
  })
  // The one sanctioned bypass in this module: a coded 403 must reach the
  // component rather than the global interceptor.
  expect(mock.history.post[0].skipAuthHandling).toBe(true)
  // Roster refetched (initial load + after attach).
  await waitFor(() => expect(rosterGets()).toHaveLength(2))
})

test('a field-map error on attach is surfaced rather than swallowed', async () => {
  const user = userEvent.setup()
  mock.onPost(ROSTER_URL).reply(400, { data: { email: 'not attachable' } })
  renderSection()
  await screen.findByText('Active Delegate')

  await user.click(
    screen.getByRole('combobox', { name: /attach an existing delegate/i })
  )
  await user.click(await screen.findByText(/Wilhuff Tarkin/i))

  expect(await screen.findByText(/not attachable/i)).toBeInTheDocument()
})

test('the provision expiry defaults to three months out', async () => {
  const user = userEvent.setup()
  renderSection()
  await screen.findByText('Active Delegate')

  await user.click(
    screen.getByRole('button', { name: /provision new delegate/i })
  )
  const dateInput = screen.getByLabelText(/access expires/i) as HTMLInputElement
  expect(dateInput.value).toBe(addMonthsISO(3))
})

test('provisioning a new person POSTs email, name, and expiry', async () => {
  const user = userEvent.setup()
  renderSection()
  await screen.findByText('Active Delegate')

  await user.click(
    screen.getByRole('button', { name: /provision new delegate/i })
  )
  await user.type(screen.getByLabelText(/^name/i), 'Moff Jerjerrod')
  await user.type(screen.getByLabelText(/^email/i), 'jerjerrod@empire.gov')
  await user.click(screen.getByRole('button', { name: /^provision$/i }))

  await waitFor(() => expect(mock.history.post).toHaveLength(1))
  const body = JSON.parse(mock.history.post[0].data)
  expect(body.email).toBe('jerjerrod@empire.gov')
  expect(body.fullname).toBe('Moff Jerjerrod')
  expect(typeof body.access_expires_at).toBe('string')
})

test('an administrator-required email shows an inline guard, not a provision', async () => {
  const user = userEvent.setup()
  mock.onPost(ROSTER_URL).reply(400, {
    error: 'admin required',
    code: 'DELEGATE_REQUIRES_ADMIN',
  })
  renderSection()
  await screen.findByText('Active Delegate')

  await user.click(
    screen.getByRole('button', { name: /provision new delegate/i })
  )
  await user.type(screen.getByLabelText(/^name/i), 'Existing Person')
  await user.type(screen.getByLabelText(/^email/i), 'existing@empire.gov')
  await user.click(screen.getByRole('button', { name: /^provision$/i }))

  // Guard renders inside the still-open provision dialog (not as a card alert
  // or toast), so the ISSO sees why the provision was refused where they acted.
  const dialog = screen.getByRole('dialog', { name: /provision new delegate/i })
  expect(
    await within(dialog).findByText(/must be handled by an administrator/i)
  ).toBeInTheDocument()
})

test('a capability-off 403 shows the OpDiv-disabled inline guard', async () => {
  const user = userEvent.setup()
  // The add call opts out of the global auth interceptor (skipAuthHandling), so
  // the coded 403 reaches the component and classifyAddError keys on the code.
  // The interceptor is real here, so this proves the bypass end to end.
  mock.onPost(ROSTER_URL).reply(403, {
    error: 'system delegate role is not enabled for this opdiv',
    code: 'DELEGATE_NOT_ENABLED',
  })
  renderSection()
  await screen.findByText('Active Delegate')

  await user.click(
    screen.getByRole('button', { name: /provision new delegate/i })
  )
  await user.type(screen.getByLabelText(/^name/i), 'Someone')
  await user.type(screen.getByLabelText(/^email/i), 'someone@empire.gov')
  await user.click(screen.getByRole('button', { name: /^provision$/i }))

  const dialog = screen.getByRole('dialog', { name: /provision new delegate/i })
  expect(
    await within(dialog).findByText(/not enabled for this OpDiv/i)
  ).toBeInTheDocument()
})

test('removing a delegate confirms then DELETEs and refetches', async () => {
  const user = userEvent.setup()
  renderSection()
  await screen.findByText('Active Delegate')

  await user.click(
    screen.getByRole('button', { name: /remove Active Delegate/i })
  )
  // Not deleted until confirmed.
  expect(mock.history.delete).toHaveLength(0)
  await user.click(screen.getByRole('button', { name: /^remove$/i }))

  await waitFor(() => expect(mock.history.delete).toHaveLength(1))
  expect(mock.history.delete[0].url).toBe(delegateUrl('d-active'))
  await waitFor(() => expect(rosterGets()).toHaveLength(2))
})

test('renewing a delegate PATCHes the new expiration', async () => {
  const user = userEvent.setup()
  renderSection()
  await screen.findByText('Active Delegate')

  await user.click(
    screen.getByRole('button', { name: /renew Active Delegate/i })
  )
  await user.click(screen.getByRole('button', { name: /^save$/i }))

  await waitFor(() => expect(mock.history.patch).toHaveLength(1))
  expect(mock.history.patch[0].url).toBe(delegateUrl('d-active'))
  const body = JSON.parse(mock.history.patch[0].data)
  expect(typeof body.access_expires_at).toBe('string')
})

test('a non-manager (ISSM) sees the roster but no controls', async () => {
  renderSection(false)
  await screen.findByText('Active Delegate')

  expect(
    screen.queryByRole('combobox', { name: /attach an existing delegate/i })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: /provision new delegate/i })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: /remove Active Delegate/i })
  ).not.toBeInTheDocument()
})
