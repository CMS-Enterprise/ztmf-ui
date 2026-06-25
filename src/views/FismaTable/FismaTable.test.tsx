import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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
    showDecommissioned: false,
    setShowDecommissioned: jest.fn(),
    dashboardSearch: '',
    setDashboardSearch: jest.fn(),
  }),
}))

jest.mock('@/utils/opdivs', () => ({
  fetchOpDivs: () => Promise.resolve([]),
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
    expect(screen.getByText('ISD-001')).toBeInTheDocument()
  })
})
