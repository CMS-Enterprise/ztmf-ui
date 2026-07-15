import { render, screen } from '@testing-library/react'
import PillarScoresModal from './PillarScoresModal'
import type { ScoreAggregate, datacall } from '@/types'

jest.mock('@/views/Title/Context', () => ({
  useContextProp: jest.fn(),
}))

const mockUseContextProp = require('@/views/Title/Context')
  .useContextProp as jest.Mock

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DATACALLS: datacall[] = [
  {
    datacallid: 5,
    datacall: 'FY2025 Q4',
    datecreated: '2025-01-01T00:00:00Z',
    deadline: '2099-12-31T00:00:00Z',
  },
  {
    datacallid: 4,
    datacall: 'FY2024 Q4',
    datecreated: '2024-01-01T00:00:00Z',
    deadline: '2024-12-31T00:00:00Z',
  },
]

const PILLAR_SCORES = [{ pillarid: 1, pillar: 'Identity', score: 3.5 }]

const SCORES: ScoreAggregate[] = [
  {
    datacallid: 5,
    fismasystemid: 1001,
    systemscore: 3.75,
    pillarscores: PILLAR_SCORES,
  },
  {
    datacallid: 4,
    fismasystemid: 1001,
    systemscore: 3.0,
    pillarscores: PILLAR_SCORES,
  },
]

const DEFAULT_PROPS = {
  open: true,
  onClose: jest.fn(),
  systemName: 'Test System',
  systemAcronym: 'TS',
  scores: SCORES,
  selectedDataCallId: 5,
}

function renderModal(props: Partial<typeof DEFAULT_PROPS> = {}) {
  return render(<PillarScoresModal {...DEFAULT_PROPS} {...props} />)
}

beforeEach(() => {
  mockUseContextProp.mockReturnValue({ datacalls: DATACALLS })
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PillarScoresModal', () => {
  it('does not render when open is false', () => {
    renderModal({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the system name and acronym in the title', () => {
    renderModal()
    expect(
      screen.getByText(/Test System \(TS\) - Pillar Scores/)
    ).toBeInTheDocument()
  })

  it('shows "No Score Data Available" when scores is empty', () => {
    renderModal({ scores: [] })
    expect(screen.getByText('No Score Data Available')).toBeInTheDocument()
  })

  it('shows score data when selectedDataCallId matches a score (primary path)', () => {
    renderModal({ selectedDataCallId: 5 })
    expect(
      screen.queryByText('No Score Data Available')
    ).not.toBeInTheDocument()
    expect(screen.getByText('3.75')).toBeInTheDocument()
  })

  // Regression guard for #521: before this fix the fallback used
  // reduce(max datacallid), which picked the wrong call when re-imported
  // historical calls have higher ids than the real current call.
  it('falls back to the deadline-latest scored call when selectedDataCallId is not in scores', () => {
    renderModal({ selectedDataCallId: 999 })
    // scoredDatacalls[0] is datacallid=5 (furthest deadline) — score 3.75
    expect(
      screen.queryByText('No Score Data Available')
    ).not.toBeInTheDocument()
    expect(screen.getByText('3.75')).toBeInTheDocument()
  })

  // #393 regression guard: a re-imported historical call can carry a higher
  // datacallid than the real current call; deadline order must win.
  it('fallback picks the furthest-deadline call, not the highest-id call', () => {
    const OUT_OF_ORDER: datacall[] = [
      // Highest id but an already-passed deadline (the historical hijacker)
      {
        datacallid: 7,
        datacall: 'FY23 ZTM',
        datecreated: '2026-01-01T00:00:00Z',
        deadline: '2023-06-30T00:00:00Z',
      },
      // Lower id but furthest-out deadline (the real current call)
      {
        datacallid: 6,
        datacall: 'FY2025 Q3',
        datecreated: '2025-01-01T00:00:00Z',
        deadline: '2099-09-30T00:00:00Z',
      },
    ]
    const MIXED_SCORES: ScoreAggregate[] = [
      {
        datacallid: 7,
        fismasystemid: 1001,
        systemscore: 2.0,
        pillarscores: [{ pillarid: 1, pillar: 'Identity', score: 2.0 }],
      },
      {
        datacallid: 6,
        fismasystemid: 1001,
        systemscore: 4.5,
        pillarscores: [{ pillarid: 1, pillar: 'Identity', score: 4.5 }],
      },
    ]
    mockUseContextProp.mockReturnValue({ datacalls: OUT_OF_ORDER })

    // selectedDataCallId doesn't match any score — triggers the fallback
    renderModal({ selectedDataCallId: 999, scores: MIXED_SCORES })

    // Deadline-latest (id=6, score=4.50) must win, not max-id (id=7, score=2.00)
    expect(
      screen.queryByText('No Score Data Available')
    ).not.toBeInTheDocument()
    // 4.50 appears in the overall score box, pillar score, and data table — all correct
    expect(screen.getAllByText('4.50').length).toBeGreaterThan(0)
  })
})
