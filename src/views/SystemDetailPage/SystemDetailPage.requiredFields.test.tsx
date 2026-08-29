// A blank Component, Data Call Contact, or ISSO Email must not block editing an
// unrelated field on a system onboarded without those values; the four fields
// the backend needs on every record still gate the save.

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
import type { FismaSystemType, userData } from '@/types'

const mock = new MockAdapter(axiosInstance)

// The four required fields are present; Component, Data Call Contact, and ISSO
// Email were never collected.
const NON_CMS_SYSTEM = {
  fismasystemid: 42,
  fismaname: 'Rebel Alliance Fleet Command',
  fismaacronym: 'RAFC',
  fismauid: 'UID-42',
  component: '',
  datacenterenvironment: 'CMS-Cloud-AWS',
  issoemail: '',
  datacallcontact: '',
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
  mock.onGet('/systemattributes').reply(200, { data: [] })
})

function renderPage(system: FismaSystemType = NON_CMS_SYSTEM) {
  mockCtx = {
    fismaSystems: [system],
    setFismaSystems: jest.fn(),
    userInfo: {
      userid: '1',
      email: 'mon.mothma@rebellion.org',
      fullname: 'Mon Mothma',
      role: 'OPDIV_ADMIN',
    } as userData,
    datacenterEnvironments: [],
    // The score hero picks its aggregate against the shared datacall list.
    datacalls: [],
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
function pageEditButton(): HTMLElement {
  return (
    screen
      // The redesign header button reads "Edit system", which also keeps it
      // apart from the target-maturity card's own Edit button.
      .queryAllByRole('button', { name: 'Edit system' })[0]
  )
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

async function enterEditMode(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText('System identity')
  await user.click(pageEditButton())
  await screen.findByRole('textbox', { name: 'ISSO Name' })
}

test('Save is enabled for a system with no Component, Data Call Contact, or ISSO Email', async () => {
  const user = userEvent.setup()
  renderPage()

  await enterEditMode(user)

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
  )
})

test('editing one field on such a system saves without filling the blank fields', async () => {
  const captured = captureSave()
  const user = userEvent.setup()
  renderPage()

  await enterEditMode(user)
  const isso = screen.getByRole('textbox', { name: 'ISSO Name' })
  await user.type(isso, 'General Dodonna')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(captured.body).toBeDefined())
  // The blank fields are sent as-is, not demanded.
  expect(captured.body).toHaveProperty('isso_name', 'General Dodonna')
  expect(captured.body).toHaveProperty('component', '')
  expect(captured.body).toHaveProperty('issoemail', '')
  expect(captured.body).toHaveProperty('datacallcontact', '')
})

test('clearing a hard-required field (FISMA Name) still blocks the save', async () => {
  const user = userEvent.setup()
  renderPage()

  await enterEditMode(user)
  await user.clear(screen.getByRole('textbox', { name: /^FISMA Name/ }))

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  )
})

test('a malformed value typed into ISSO Email still blocks the save', async () => {
  const user = userEvent.setup()
  renderPage()

  await enterEditMode(user)
  // Optional-to-edit is not unvalidated: a present value must be a valid address.
  await user.type(
    screen.getByRole('textbox', { name: 'ISSO Email' }),
    'not-an-email'
  )

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  )
})
