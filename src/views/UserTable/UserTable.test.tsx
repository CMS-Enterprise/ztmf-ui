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

// OpDivs lookup hits a separate utility, not axiosInstance directly; mock
// the module so the loadOpDivs effect resolves without us having to register
// a MockAdapter handler for it.
jest.mock('@/utils/opdivs', () => ({
  fetchOpDivs: () =>
    Promise.resolve([
      { opdiv_id: 1, code: 'CDC', name: 'CDC', is_parent: false, active: true },
      { opdiv_id: 2, code: 'NIH', name: 'NIH', is_parent: false, active: true },
    ]),
}))
jest.mock('@/utils/userOpdivs', () => ({
  fetchUserOpDivs: () => Promise.resolve([]),
  grantOpDiv: jest.fn().mockResolvedValue(undefined),
  revokeOpDiv: jest.fn().mockResolvedValue(undefined),
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
})
