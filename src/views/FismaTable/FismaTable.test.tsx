import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// axiosConfig reads import.meta, which Jest's CJS transform cannot parse -
// same import-meta dance as the other view tests.
jest.mock('@/axiosConfig', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}))

import FismaTable from './FismaTable'

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
        decommissioned: false,
        opdiv_id: 5,
      },
    ],
    userInfo: { role: 'OWNER' },
    // The OpDiv code column resolves ids against this shared context list.
    opdivs: [{ opdiv_id: 5, code: 'CMS', name: 'CMS', active: true }],
    latestDataCallId: 5,
    selectedDatacall: null,
    activeDatacallIds: [],
    datacalls: [],
    datacenterEnvironments: [],
    showDecommissioned: false,
    setShowDecommissioned: jest.fn(),
    dashboardSearch: '',
    setDashboardSearch: jest.fn(),
  }),
}))

describe('FismaTable', () => {
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
})
