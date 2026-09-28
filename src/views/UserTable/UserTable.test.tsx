import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'

// Same import-meta dance as the other view tests: sidestep the production
// axiosConfig (reads import.meta.env) and stub the router module the
// interceptor would otherwise drag in.
jest.mock('@/router/router', () => ({
  __esModule: true,
  default: { navigate: jest.fn() },
}))
jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: '/api/v1/' }) }
})
// utils/config reads import.meta.env at module scope, which swc/jest can't
// evaluate; the table only reads CONFIG.IDP_ENABLED (IdP column gating).
jest.mock('@/utils/config', () => ({
  __esModule: true,
  default: { IDP_ENABLED: false },
}))

// Title/Context is consumed via useOutletContext; the renderWithProviders
// MemoryRouter has no matching outlet, so stub the hook directly.
jest.mock('../Title/Context', () => ({
  useContextProp: () => ({
    userInfo: {
      userid: 'me',
      role: 'OWNER',
      email: 'me@x.gov',
      fullname: 'Me',
    },
    fismaSystems: [],
    setFismaSystems: jest.fn(),
    // The OpDiv catalog hook derives its projections from this shared list
    // (Title fetches /opdivs once), so the columns and filter read it here.
    opdivs: [
      { opdiv_id: 1, code: 'CDC', name: 'CDC', is_parent: false, active: true },
      { opdiv_id: 2, code: 'NIH', name: 'NIH', is_parent: false, active: true },
    ],
    latestDataCallId: 1,
    latestDatacall: 'FY2025',
    latestDeadline: '',
    datacalls: [],
    selectedDatacall: null,
    setSelectedDatacall: jest.fn(),
    showDecommissioned: false,
    setShowDecommissioned: jest.fn(),
    fetchFismaSystems: jest.fn(),
    dashboardSearch: '',
    setDashboardSearch: jest.fn(),
  }),
}))

import axiosInstance from '@/axiosConfig'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import UserTable from './UserTable'

const mock = new MockAdapter(axiosInstance)

const rows = [
  {
    userid: '1',
    email: 'leia@rebellion.gov',
    fullname: 'Leia Organa',
    role: 'HHS_ADMIN',
    assignedfismasystems: [],
    assignedopdivids: [1],
    identity_provider: 'okta',
  },
  {
    userid: '2',
    email: 'han@falcon.gov',
    fullname: 'Han Solo',
    role: 'ISSO',
    assignedfismasystems: [],
    assignedopdivids: [2],
    identity_provider: 'entra',
  },
  {
    userid: '3',
    email: 'luke@jedi.gov',
    fullname: 'Luke Skywalker',
    role: 'OPDIV_ADMIN',
    assignedfismasystems: [],
    assignedopdivids: [1, 2],
    identity_provider: 'okta',
  },
]

beforeEach(() => {
  mock.reset()
  mock.onGet('/users').reply(200, { data: rows })
})

// Note: the DataGrid virtualizes far-right cells under jsdom, so the
// rightmost Actions column is not asserted from this suite. ActionsCell and
// NameEditCell are exercised in their own component-level tests; this suite
// guards table-level concerns (load, filter, toolbar wiring).
describe('UserTable', () => {
  test('renders one row per user from the /users response', async () => {
    renderWithProviders(<UserTable />)
    expect(await screen.findByText('Leia Organa')).toBeInTheDocument()
    expect(screen.getByText('Han Solo')).toBeInTheDocument()
    expect(screen.getByText('Luke Skywalker')).toBeInTheDocument()
    // Email lives in a hidden grid column but is rendered inside the Name
    // cell as the meta line - assert one to prove the cell composition is
    // intact.
    expect(screen.getByText('leia@rebellion.gov')).toBeInTheDocument()
  })

  test('search input narrows visible rows via the DataGrid quick filter', async () => {
    renderWithProviders(<UserTable />)
    await screen.findByText('Leia Organa')

    const search = screen.getByPlaceholderText(/Search by name, email/i)
    await userEvent.type(search, 'Han')

    await waitFor(() => {
      expect(screen.queryByText('Leia Organa')).not.toBeInTheDocument()
      expect(screen.queryByText('Luke Skywalker')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Han Solo')).toBeInTheDocument()
  })

  test('OpDiv filter narrows rows to users granted that OpDiv', async () => {
    renderWithProviders(<UserTable />)
    await screen.findByText('Leia Organa')

    // The OpDiv filter is an Autocomplete - clicking the input + typing the
    // code narrows the popover; selecting the option commits the filter.
    const opdivInput = screen.getByPlaceholderText('OpDiv')
    await userEvent.click(opdivInput)
    await userEvent.type(opdivInput, 'NIH')
    const opt = await screen.findByRole('option', { name: /NIH/ })
    await userEvent.click(opt)

    await waitFor(() => {
      expect(screen.queryByText('Leia Organa')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Han Solo')).toBeInTheDocument()
    expect(screen.getByText('Luke Skywalker')).toBeInTheDocument()
  })

  // #736 converted the OpDiv grant plumbing to useUserOpDivs/useSetUserOpDivs
  // (see OpDivGrantModal.test.tsx for the mutation's request/invalidation
  // behavior). The "Show deactivated" toggle round-trips through
  // useLoadUsers's own /users?deleted= refetch; useLoadUsers's other
  // responsibilities (the old-backend grants backfill, race safety, catalog
  // fetch/cancellation) are covered in hooks/useLoadUsers.test.ts and
  // hooks/useSystemCatalog.test.ts.
  test('"Show deactivated" toggle refetches /users with the deleted flag', async () => {
    renderWithProviders(<UserTable />)
    await screen.findByText('Leia Organa')

    const deletedRow = {
      userid: '9',
      email: 'boba@bounty.gov',
      fullname: 'Boba Fett',
      role: 'ISSO',
      assignedfismasystems: [],
      assignedopdivids: [],
      identity_provider: 'okta',
      deleted: true,
    }
    mock.onGet('/users').reply((config) => {
      const deleted = config.params?.deleted
      return [200, { data: deleted ? [deletedRow] : rows }]
    })

    const toggle = screen.getByRole('checkbox', { name: /show deactivated/i })
    await userEvent.click(toggle)

    expect(await screen.findByText('Boba Fett')).toBeInTheDocument()
    expect(screen.queryByText('Leia Organa')).not.toBeInTheDocument()
  })

  // Coherence check for the fix that removed userOpDivMap: a legacy row
  // missing assignedopdivids gets it backfilled onto the row itself, so the
  // OpDivs column (which reads row.assignedopdivids alone) renders the
  // backfilled grant with no separate map to fall out of sync with.
  test('a legacy row missing assignedopdivids renders its backfilled OpDiv grant', async () => {
    const legacyRow = {
      userid: '4',
      email: 'chewie@falcon.gov',
      fullname: 'Chewbacca',
      role: 'ISSO',
      assignedfismasystems: [],
      identity_provider: 'okta',
      // No assignedopdivids key at all - the older-backend shape.
    }
    mock.onGet('/users').reply(200, { data: [legacyRow] })
    mock.onGet('/users/4/assignedopdivs').reply(200, { data: [2] })

    renderWithProviders(<UserTable />)
    await screen.findByText('Chewbacca')

    expect(await screen.findByText('NIH')).toBeInTheDocument()
  })

  // The OpDiv filter must read the same backfilled value the column just
  // rendered, not a stale separate map - this is the exact incoherence the
  // userOpDivMap removal fixed.
  test("the OpDiv filter narrows using a legacy row's backfilled grant, not a stale value", async () => {
    const legacyRow = {
      userid: '4',
      email: 'chewie@falcon.gov',
      fullname: 'Chewbacca',
      role: 'ISSO',
      assignedfismasystems: [],
      identity_provider: 'okta',
      // No assignedopdivids key at all - the older-backend shape.
    }
    mock.onGet('/users').reply(200, { data: [legacyRow, rows[0]] })
    mock.onGet('/users/4/assignedopdivs').reply(200, { data: [2] })

    renderWithProviders(<UserTable />)
    await screen.findByText('Chewbacca')
    // Wait for the backfill to land before filtering, so the filter's read
    // is exercised against the backfilled value rather than racing it.
    await screen.findByText('NIH')

    const opdivInput = screen.getByPlaceholderText('OpDiv')
    await userEvent.click(opdivInput)
    await userEvent.type(opdivInput, 'NIH')
    const opt = await screen.findByRole('option', { name: /NIH/ })
    await userEvent.click(opt)

    await waitFor(() => {
      expect(screen.queryByText('Leia Organa')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Chewbacca')).toBeInTheDocument()
  })
})
