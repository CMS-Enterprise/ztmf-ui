// Role coverage for the ISSO Name control on the System Details page, plus the
// two write signals it can send. The page-level isAdmin gate is the only gate
// on the field: the whole edit surface (the Edit button and the edit view) is
// admin-only, so the write-admin tiers get the control and every other tier
// never reaches an editable form at all. A typed name is a permanent override
// of the name derived from the ISSO user record; the empty string clears the
// override.

// axiosConfig reads import.meta.env at module load and throws under @swc/jest.
// Swap in a bare axios instance the MockAdapter can drive.
jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: '/api/v1/' }) }
})
jest.mock('@/utils/notify', () => {
  const actual = jest.requireActual('@/utils/notify')
  return { ...actual, notify: jest.fn() }
})

// The page reads its shared state via useContextProp (useOutletContext).
let mockCtx: Record<string, unknown>
jest.mock('../Title/Context', () => ({
  useContextProp: () => mockCtx,
}))

import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import MockAdapter from 'axios-mock-adapter'
import SystemDetailPage from './SystemDetailPage'
import axiosInstance from '@/axiosConfig'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import type { FismaSystemType, UserRole, userData } from '@/types'

const mock = new MockAdapter(axiosInstance)

const SYSTEM = {
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
  // Both enrichment (ZTMF Insights) and the delegates roster are gated off in
  // this fixture so the page's only network reads are opdivs and the
  // system-attribute vocabulary.
  sdl_sync_enabled: false,
  isso_name: 'Conan Antonio Motti',
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

const WRITE_ADMIN_ROLES: UserRole[] = ['OWNER', 'HHS_ADMIN', 'OPDIV_ADMIN']

const NON_WRITE_ROLES: UserRole[] = [
  'HHS_READONLY_ADMIN',
  'OPDIV_READONLY_ADMIN',
  'ISSO',
  'ISSM',
  'SYSTEM_DELEGATE',
]

beforeEach(() => {
  mock.reset()
  mock.onGet('/systemattributes').reply(200, { data: [] })
})

/**
 * Renders the page for a system owned by the given role, on the route the
 * page reads :fismasystemid from.
 */
function renderPage(role: UserRole, system: FismaSystemType = SYSTEM) {
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
    // OpDivs now arrive on the shared Outlet context instead of a per-page GET.
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
    // The page refetches after a save instead of echoing its draft, so both of
    // these have to be present or the save path throws.
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

/**
 * The page-level Edit buttons currently on screen. The target-maturity card
 * renders its own Edit button in view mode (for admins and for an assigned
 * ISSO/ISSM), so match the header button by its CMS design-system class to keep
 * the two apart: only the header one opens the system form.
 */
function pageEditButtons(): HTMLElement[] {
  return screen
    .queryAllByRole('button', { name: 'Edit' })
    .filter((button) => button.classList.contains('ds-c-button'))
}

/** Captures the body of the page's full-system PUT. */
function captureSave() {
  const captured: { body?: Record<string, unknown> } = {}
  mock.onPut(/fismasystems\/42$/).reply((config) => {
    captured.body = JSON.parse(config.data)
    return [200, {}]
  })
  return captured
}

test.each(WRITE_ADMIN_ROLES)(
  'ISSO Name is an editable control for %s',
  async (role) => {
    const user = userEvent.setup()
    renderPage(role)

    await screen.findByText('System Identity')
    await user.click(pageEditButtons()[0])

    expect(
      await screen.findByRole('textbox', { name: 'ISSO Name' })
    ).toBeEnabled()
  }
)

test.each(NON_WRITE_ROLES)(
  '%s gets no system-form edit affordance and no ISSO Name control',
  async (role) => {
    renderPage(role)

    await screen.findByText('System Identity')
    expect(pageEditButtons()).toHaveLength(0)
    // The read view is the only view these tiers reach, and it renders every
    // field as text, so there is no control to disable.
    expect(
      screen.queryByRole('textbox', { name: 'ISSO Name' })
    ).not.toBeInTheDocument()
  }
)

test('an edited ISSO Name is sent in the save payload', async () => {
  const captured = captureSave()
  const user = userEvent.setup()
  renderPage('OPDIV_ADMIN')

  await screen.findByText('System Identity')
  await user.click(pageEditButtons()[0])
  const input = await screen.findByRole('textbox', { name: 'ISSO Name' })
  await user.clear(input)
  await user.type(input, 'Firmus Piett')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(captured.body).toBeDefined())
  expect(captured.body).toHaveProperty('isso_name', 'Firmus Piett')
})

test('clearing ISSO Name sends the empty-string clear signal', async () => {
  const captured = captureSave()
  const user = userEvent.setup()
  renderPage('OPDIV_ADMIN')

  await screen.findByText('System Identity')
  await user.click(pageEditButtons()[0])
  await user.clear(await screen.findByRole('textbox', { name: 'ISSO Name' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(captured.body).toBeDefined())
  // '' clears the stored override via blankToNil so the name derived from the
  // ISSO user record applies again; null would read as "leave unchanged".
  expect(captured.body).toHaveProperty('isso_name', '')
})

// The saved value of isso_name is resolved by the backend, so the draft the
// page sent is not the truth once the field was cleared. Echoing the draft into
// shared state would render the cleared field as empty instead of the derived
// name, so the page has to refetch and must not write the draft.
test('clearing ISSO Name refetches instead of echoing the draft', async () => {
  const captured = captureSave()
  const user = userEvent.setup()
  renderPage('OPDIV_ADMIN')

  await screen.findByText('System Identity')
  await user.click(pageEditButtons()[0])
  await user.clear(await screen.findByRole('textbox', { name: 'ISSO Name' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(captured.body).toBeDefined())
  await waitFor(() =>
    expect(mockCtx.fetchFismaSystems).toHaveBeenCalledWith(false)
  )
  expect(mockCtx.setFismaSystems).not.toHaveBeenCalled()
})

// A save must not silently change which systems the dashboard lists, so the
// refetch carries the caller's current decommissioned view mode.
test('the post-save refetch preserves the decommissioned view mode', async () => {
  const captured = captureSave()
  const user = userEvent.setup()
  renderPage('OPDIV_ADMIN')
  mockCtx.showDecommissioned = true

  await screen.findByText('System Identity')
  await user.click(pageEditButtons()[0])
  const input = await screen.findByRole('textbox', { name: 'ISSO Name' })
  await user.clear(input)
  await user.type(input, 'Firmus Piett')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(captured.body).toBeDefined())
  await waitFor(() =>
    expect(mockCtx.fetchFismaSystems).toHaveBeenCalledWith(true)
  )
})

test('an untouched ISSO Name is omitted from the save payload', async () => {
  const captured = captureSave()
  const user = userEvent.setup()
  renderPage('OPDIV_ADMIN')

  await screen.findByText('System Identity')
  await user.click(pageEditButtons()[0])
  await screen.findByRole('textbox', { name: 'ISSO Name' })
  await user.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(captured.body).toBeDefined())
  // The detail page shows the resolved name, so sending it back unedited would
  // persist a derived name as an override on any unrelated save.
  expect(captured.body).not.toHaveProperty('isso_name')
})
