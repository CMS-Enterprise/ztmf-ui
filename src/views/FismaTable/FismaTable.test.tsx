import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// axiosConfig reads import.meta, which Jest's CJS transform cannot parse -
// same import-meta dance as the other view tests.
jest.mock('@/axiosConfig', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}))

import FismaTable from './FismaTable'

let mockDashboardSearch = ''

// Provide just enough context for the table to render one system row.
jest.mock('../Title/Context', () => ({
  useContextProp: () => ({
    fismaSystems: [
      {
        fismasystemid: 1,
        fismaname: 'Imperial Star Destroyer',
        fismaacronym: 'ISD',
        fismauid: 'ISD-001',
        mission: 'Sole Galactic Empire flagship',
        datacenterenvironment: 'Imperial Cloud',
        fips: 'Moderate',
        decommissioned: false,
        opdiv_id: 5,
      },
      {
        fismasystemid: 2,
        fismaname: 'Death Star',
        fismaacronym: 'DS',
        fismauid: 'DS-001',
        mission: 'Orbital battle station',
        datacenterenvironment: 'Battle Station',
        fips: 'High',
        decommissioned: false,
        opdiv_id: 7,
      },
    ],
    userInfo: { role: 'OWNER' },
    // The OpDiv code column resolves ids against this shared context list.
    opdivs: [
      { opdiv_id: 5, code: 'CMS', name: 'CMS', active: true },
      { opdiv_id: 7, code: 'HHS', name: 'HHS', active: true },
    ],
    latestDataCallId: 5,
    selectedDatacall: null,
    activeDatacallIds: [],
    datacalls: [],
    datacenterEnvironments: [],
    showDecommissioned: false,
    setShowDecommissioned: jest.fn(),
    dashboardSearch: mockDashboardSearch,
    setDashboardSearch: jest.fn(),
  }),
}))

describe('FismaTable', () => {
  beforeEach(() => {
    mockDashboardSearch = ''
  })

  // Smoke test that the table renders a row from the systems list. The score
  // cell renders <ScoreDisplay>, which is unit-tested separately; the grid's
  // column virtualization makes asserting far-right cells unreliable under
  // jsdom, so this guards the leftmost columns only.
  it('renders a system row from context', async () => {
    render(
      <MemoryRouter>
        <FismaTable scores={{ 1: { score: 4, tier: 'Optimal' } }} />
      </MemoryRouter>
    )
    expect(
      await screen.findByText('Imperial Star Destroyer')
    ).toBeInTheDocument()
    // FISMA UID column was dropped in the redesign; Acronym replaces it
    // as the per-row identifier on the leftmost stripe of cells.
    expect(screen.getByText('ISD')).toBeInTheDocument()
  })

  it('shows the complete system identity when hovering its table cell', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <FismaTable scores={{}} />
      </MemoryRouter>
    )

    await user.hover(
      await screen.findByRole('link', { name: 'Imperial Star Destroyer' })
    )

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Imperial Star Destroyer - Sole Galactic Empire flagship'
    )
  })

  it('renders Data center and FIPS columns but not the removed Data Call column', async () => {
    render(
      <MemoryRouter>
        <FismaTable scores={{}} />
      </MemoryRouter>
    )

    expect(
      await screen.findByRole('columnheader', { name: 'System' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: 'Data center' })
    ).toBeInTheDocument()
    // The grid virtualizes FIPS just beyond jsdom's visible columns. The
    // restored Data center + FIPS pair raises the complete column model from
    // seven to nine even though only the nearer header mounts here.
    expect(screen.getByRole('grid')).toHaveAttribute('aria-colcount', '9')
    expect(
      screen.queryByRole('columnheader', { name: 'Data Call' })
    ).not.toBeInTheDocument()
  })

  it('counts only rows matching the current search', async () => {
    mockDashboardSearch = 'death'

    render(
      <MemoryRouter>
        <FismaTable scores={{}} />
      </MemoryRouter>
    )

    expect(await screen.findByText('1 system')).toBeInTheDocument()
    expect(screen.getByText('Death Star')).toBeInTheDocument()
    expect(
      screen.queryByText('Imperial Star Destroyer')
    ).not.toBeInTheDocument()
  })

  it('renders each toolbar control once without changing filter semantics', async () => {
    render(
      <MemoryRouter>
        <FismaTable scores={{}} />
      </MemoryRouter>
    )

    expect(await screen.findByLabelText('Search systems')).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', { name: 'Open data call only' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', { name: 'Not updated only' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', { name: 'Show decommissioned' })
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Filter by environment')).toBeInTheDocument()
    expect(screen.getByLabelText('Filter by OpDiv')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeDisabled()
  })
})
