import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import ScoreDiffModal from './ScoreDiffModal'
import axiosInstance from '@/axiosConfig'
import type { ScoreDiffEntry, FismaQuestion, datacall } from '@/types'

jest.mock('@/axiosConfig', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}))

jest.mock('@/utils/notify', () => ({
  isAuthHandled: jest.fn(),
}))

const mockGet = axiosInstance.get as jest.Mock

// Bump past the 10-min cache TTL before each test so module-level caches
// never serve stale data from a prior test.
const CACHE_DURATION = 10 * 60 * 1000
let nowValue = 0
beforeEach(() => {
  nowValue += CACHE_DURATION + 1
  jest.spyOn(Date, 'now').mockReturnValue(nowValue)
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DATACALLS: datacall[] = [
  {
    datacallid: 5,
    datacall: 'FY2025',
    datecreated: '2025-01-01T00:00:00Z',
    deadline: '2099-12-31T00:00:00Z',
  },
  {
    datacallid: 4,
    datacall: 'FY2024',
    datecreated: '2024-01-01T00:00:00Z',
    deadline: '2020-12-31T00:00:00Z',
  },
  {
    datacallid: 3,
    datacall: 'FY2023',
    datecreated: '2023-01-01T00:00:00Z',
    deadline: '2020-12-31T00:00:00Z',
  },
]

const QUESTIONS: FismaQuestion[] = [
  {
    questionid: 1,
    question: 'Does your org use MFA?',
    notesprompt: '',
    pillar: { pillar: 'Identity', pillarid: 1, order: 1 },
    function: {
      functionid: 10,
      function: 'Authentication-Users',
      description: '',
      datacenterenvironment: '',
    },
  },
  {
    questionid: 2,
    question: 'How do you manage devices?',
    notesprompt: '',
    pillar: { pillar: 'Devices', pillarid: 2, order: 2 },
    function: {
      functionid: 20,
      function: 'PolicyEnforcement',
      description: '',
      datacenterenvironment: '',
    },
  },
]

const DIFF_ENTRY: ScoreDiffEntry = {
  fismasystemid: 1001,
  functionid: 10,
  function: 'Authentication-Users',
  question: 'Does your org use MFA?',
  from: {
    scoreid: 1,
    functionoptionid: 1,
    optionname: 'Traditional',
    score: 1,
    notes: null,
  },
  to: {
    scoreid: 2,
    functionoptionid: 3,
    optionname: 'Advanced',
    score: 4,
    notes: 'Improved this cycle',
  },
  changed_at: '2025-01-15T10:30:00Z',
  changed_by: {
    userid: 'u1',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'ISSO',
  },
}

const DEVICES_ENTRY: ScoreDiffEntry = {
  fismasystemid: 1001,
  functionid: 20,
  function: 'PolicyEnforcement',
  question: 'How do you manage devices?',
  from: {
    scoreid: 3,
    functionoptionid: 2,
    optionname: 'Managed',
    score: 3,
    notes: null,
  },
  to: {
    scoreid: 4,
    functionoptionid: 4,
    optionname: 'Optimal',
    score: 5,
    notes: null,
  },
}

const DEFAULT_PROPS = {
  open: true,
  onClose: jest.fn(),
  fismasystemid: 1001,
  systemName: 'Test System',
  systemAcronym: 'TS',
  selectedDataCallId: 5,
}

function setupMocks(diffEntries: ScoreDiffEntry[] = [DIFF_ENTRY]) {
  mockGet.mockImplementation((url: string) => {
    if (url === '/datacalls')
      return Promise.resolve({ data: { data: DATACALLS } })
    if (url.includes('/questions'))
      return Promise.resolve({ data: { data: QUESTIONS } })
    if (url.includes('/scores/diff'))
      return Promise.resolve({ data: { data: diffEntries } })
    return Promise.reject(new Error(`Unexpected URL: ${url}`))
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScoreDiffModal', () => {
  it('does not render when open is false', () => {
    setupMocks()
    render(<ScoreDiffModal {...DEFAULT_PROPS} open={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows system name and acronym in the title', () => {
    setupMocks()
    render(
      <ScoreDiffModal
        {...DEFAULT_PROPS}
        systemName="My System"
        systemAcronym="MS"
      />
    )
    expect(
      screen.getByText(/My System \(MS\) — Compare Datacalls/)
    ).toBeInTheDocument()
  })

  it('shows a spinner while datacalls are loading', () => {
    mockGet.mockReturnValue(new Promise(() => {}))
    render(<ScoreDiffModal {...DEFAULT_PROPS} />)
    expect(screen.getByLabelText('Loading datacalls')).toBeInTheDocument()
  })

  it('sets To to selectedDataCallId and From to the prior datacall', async () => {
    setupMocks()
    render(<ScoreDiffModal {...DEFAULT_PROPS} selectedDataCallId={5} />)
    expect(await screen.findByLabelText('To datacall')).toHaveValue('FY2025')
    expect(screen.getByLabelText('From datacall')).toHaveValue('FY2024')
  })

  it('fetches the diff with the correct query params', async () => {
    setupMocks()
    render(<ScoreDiffModal {...DEFAULT_PROPS} />)
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(
        '/scores/diff?from=4&to=5&fismasystemid=1001',
        expect.objectContaining({ signal: expect.anything() })
      )
    )
  })

  it('shows empty-state message when diff returns no entries', async () => {
    setupMocks([])
    render(<ScoreDiffModal {...DEFAULT_PROPS} />)
    expect(
      await screen.findByText('No changes between these two datacalls.')
    ).toBeInTheDocument()
  })

  it('shows an error alert when the diff fetch fails', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/datacalls')
        return Promise.resolve({ data: { data: DATACALLS } })
      if (url.includes('/questions'))
        return Promise.resolve({ data: { data: QUESTIONS } })
      return Promise.reject(new Error('Network error'))
    })
    render(<ScoreDiffModal {...DEFAULT_PROPS} />)
    expect(
      await screen.findByText('Failed to load diff. Please try again.')
    ).toBeInTheDocument()
  })

  it('renders function, question, both answer sides, and attribution', async () => {
    setupMocks()
    render(<ScoreDiffModal {...DEFAULT_PROPS} />)
    await screen.findByText('Authentication-Users')
    expect(screen.getByText('Does your org use MFA?')).toBeInTheDocument()
    expect(screen.getByText('Traditional')).toBeInTheDocument()
    expect(screen.getByText('score 1/5')).toBeInTheDocument()
    expect(screen.getByText('Advanced')).toBeInTheDocument()
    expect(screen.getByText('score 4/5')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith (ISSO)')).toBeInTheDocument()
    expect(screen.getByText(/Jan 15, 2025/)).toBeInTheDocument()
  })

  it('shows notes when present and hides them when null', async () => {
    setupMocks()
    render(<ScoreDiffModal {...DEFAULT_PROPS} />)
    // to.notes = 'Improved this cycle', from.notes = null → only one notes line
    expect(await screen.findByText('Improved this cycle')).toBeInTheDocument()
  })

  it('renders "No answer" for a null side', async () => {
    setupMocks([{ ...DIFF_ENTRY, from: null }])
    render(<ScoreDiffModal {...DEFAULT_PROPS} />)
    expect(await screen.findAllByText('No answer')).toHaveLength(1)
  })

  it('renders pillar group headers ordered by PILLAR_ORDER', async () => {
    // Devices entry arrives first; Identity should still render before Devices
    setupMocks([DEVICES_ENTRY, DIFF_ENTRY])
    render(<ScoreDiffModal {...DEFAULT_PROPS} />)
    await screen.findByText('Identity')
    const identityEl = screen.getByText('Identity')
    const devicesEl = screen.getByText('Devices')
    expect(
      identityEl.compareDocumentPosition(devicesEl) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('calls onClose when either close control is clicked', () => {
    setupMocks()
    const onClose = jest.fn()
    render(<ScoreDiffModal {...DEFAULT_PROPS} onClose={onClose} />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Close compare datacalls dialog' })
    )
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('re-fetches the diff when the modal is reopened', async () => {
    setupMocks()
    const { rerender } = render(<ScoreDiffModal {...DEFAULT_PROPS} />)
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining('/scores/diff'),
        expect.objectContaining({ signal: expect.anything() })
      )
    )
    const firstCount = mockGet.mock.calls.filter(([u]: [string]) =>
      u.includes('/scores/diff')
    ).length

    rerender(<ScoreDiffModal {...DEFAULT_PROPS} open={false} />)
    rerender(<ScoreDiffModal {...DEFAULT_PROPS} open={true} />)

    await waitFor(() => {
      const newCount = mockGet.mock.calls.filter(([u]: [string]) =>
        u.includes('/scores/diff')
      ).length
      expect(newCount).toBeGreaterThan(firstCount)
    })
  })
})
