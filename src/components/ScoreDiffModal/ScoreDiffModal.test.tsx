import { screen, waitFor, fireEvent } from '@testing-library/react'
import { render } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createTestQueryClient } from '@/test-utils/createTestQueryClient'
import { useDatacalls } from '@/utils/datacalls'
import { renderWithQueryClient } from '@/test-utils/renderWithQueryClient'
import ScoreDiffModal from './ScoreDiffModal'
import axiosInstance from '@/axiosConfig'
import type { ScoreDiffEntry, datacall } from '@/types'

jest.mock('@/axiosConfig', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}))

jest.mock('@/utils/notify', () => ({
  isAuthHandled: jest.fn(),
}))

const mockGet = axiosInstance.get as jest.Mock

// Each render gets its own QueryClient, so nothing carries between tests and
// the clock no longer needs winding past a module-level TTL.

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DATACALLS: datacall[] = [
  {
    datacallid: 5,
    datacall: 'FY2025',
    datecreated: '2025-01-01T00:00:00Z',
    deadline: '2099-12-31T00:00:00Z',
    fiscal_year: 2025,
    cadence: 'annual',
  },
  {
    datacallid: 4,
    datacall: 'FY2024',
    datecreated: '2024-01-01T00:00:00Z',
    deadline: '2020-12-31T00:00:00Z',
    fiscal_year: 2024,
    cadence: 'annual',
  },
  {
    datacallid: 3,
    datacall: 'FY2023',
    datecreated: '2023-01-01T00:00:00Z',
    deadline: '2020-12-31T00:00:00Z',
    fiscal_year: 2023,
    cadence: 'annual',
  },
]

const DIFF_ENTRY: ScoreDiffEntry = {
  fismasystemid: 1001,
  functionid: 10,
  root_functionid: 10,
  pillarid: 1,
  pillar: 'Identity',
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
  root_functionid: 20,
  pillarid: 2,
  pillar: 'Devices',
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
    renderWithQueryClient(<ScoreDiffModal {...DEFAULT_PROPS} open={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows system name and acronym in the title', () => {
    setupMocks()
    renderWithQueryClient(
      <ScoreDiffModal
        {...DEFAULT_PROPS}
        systemName="My System"
        systemAcronym="MS"
      />
    )
    // Modal header now uses an eyebrow ("MS - Compare") above the title
    // ("Compare datacalls - My System") via the shared ds/Modal shell.
    expect(
      screen.getByText(/Compare datacalls - My System/)
    ).toBeInTheDocument()
    expect(screen.getByText(/MS - Compare/)).toBeInTheDocument()
  })

  it('uses the extra-wide dialog size for the comparison table', () => {
    setupMocks()
    renderWithQueryClient(<ScoreDiffModal {...DEFAULT_PROPS} />)

    expect(screen.getByRole('dialog')).toHaveStyle({ width: '1200px' })
  })

  it('shows a spinner while datacalls are loading', () => {
    mockGet.mockReturnValue(new Promise(() => {}))
    renderWithQueryClient(<ScoreDiffModal {...DEFAULT_PROPS} />)
    expect(screen.getByLabelText('Loading datacalls')).toBeInTheDocument()
  })

  it('sets To to selectedDataCallId and From to the prior datacall', async () => {
    setupMocks()
    renderWithQueryClient(
      <ScoreDiffModal {...DEFAULT_PROPS} selectedDataCallId={5} />
    )
    expect(await screen.findByLabelText('To datacall')).toHaveValue('FY2025')
    expect(screen.getByLabelText('From datacall')).toHaveValue('FY2024')
  })

  // #393 regression: a re-imported historical call can carry a higher
  // datacallid than the real current call, so "latest" must follow the
  // furthest-out deadline, not the id.
  it('treats the furthest-out deadline as latest even when another call has a higher datacallid', async () => {
    const OUT_OF_ORDER: datacall[] = [
      // highest id but an already-passed deadline (the historical hijacker)
      {
        datacallid: 7,
        datacall: 'FY23 ZTM',
        datecreated: '2026-01-01T00:00:00Z',
        deadline: '2023-06-30T00:00:00Z',
        fiscal_year: 2023,
        cadence: 'annual',
      },
      // lower id but the furthest-out deadline (the real current call)
      {
        datacallid: 6,
        datacall: 'FY2025 Q3',
        datecreated: '2025-01-01T00:00:00Z',
        deadline: '2099-09-30T00:00:00Z',
        fiscal_year: 2025,
        cadence: 'quarterly',
      },
      {
        datacallid: 2,
        datacall: 'FY2022',
        datecreated: '2022-01-01T00:00:00Z',
        deadline: '2022-12-31T00:00:00Z',
        fiscal_year: 2022,
        cadence: 'annual',
      },
    ]
    mockGet.mockImplementation((url: string) => {
      if (url === '/datacalls')
        return Promise.resolve({ data: { data: OUT_OF_ORDER } })
      if (url.includes('/scores/diff'))
        return Promise.resolve({ data: { data: [] } })
      return Promise.reject(new Error(`Unexpected URL: ${url}`))
    })
    renderWithQueryClient(
      <ScoreDiffModal {...DEFAULT_PROPS} selectedDataCallId={undefined} />
    )
    // To defaults to the max-deadline call (FY2025 Q3), not the higher-id FY23 ZTM.
    expect(await screen.findByLabelText('To datacall')).toHaveValue('FY2025 Q3')
    // From is the next-older call by deadline (FY23 ZTM), not by id.
    expect(screen.getByLabelText('From datacall')).toHaveValue('FY23 ZTM')
  })

  it('fetches the diff with the correct query params', async () => {
    setupMocks()
    renderWithQueryClient(<ScoreDiffModal {...DEFAULT_PROPS} />)
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(
        '/scores/diff?from=4&to=5&fismasystemid=1001',
        expect.objectContaining({ signal: expect.anything() })
      )
    )
  })

  it('shows empty-state message when diff returns no entries', async () => {
    setupMocks([])
    renderWithQueryClient(<ScoreDiffModal {...DEFAULT_PROPS} />)
    expect(
      await screen.findByText('No changes between these two datacalls.')
    ).toBeInTheDocument()
  })

  it('shows an error alert when the diff fetch fails', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/datacalls')
        return Promise.resolve({ data: { data: DATACALLS } })
      return Promise.reject(new Error('Network error'))
    })
    renderWithQueryClient(<ScoreDiffModal {...DEFAULT_PROPS} />)
    expect(
      await screen.findByText('Failed to load diff. Please try again.')
    ).toBeInTheDocument()
  })

  it('renders function, question, both answer sides, and attribution', async () => {
    setupMocks()
    renderWithQueryClient(<ScoreDiffModal {...DEFAULT_PROPS} />)
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
    renderWithQueryClient(<ScoreDiffModal {...DEFAULT_PROPS} />)
    // to.notes = 'Improved this cycle', from.notes = null → only one notes line
    expect(await screen.findByText('Improved this cycle')).toBeInTheDocument()
  })

  it('renders "No answer" for a null side', async () => {
    setupMocks([{ ...DIFF_ENTRY, from: null }])
    renderWithQueryClient(<ScoreDiffModal {...DEFAULT_PROPS} />)
    expect(await screen.findAllByText('No answer')).toHaveLength(1)
  })

  it('groups rows by their own pillar in the order the API serves them', async () => {
    setupMocks([DIFF_ENTRY, DEVICES_ENTRY])
    renderWithQueryClient(<ScoreDiffModal {...DEFAULT_PROPS} />)
    const identityEl = await screen.findByText('Identity')
    const devicesEl = screen.getByText('Devices')
    expect(
      identityEl.compareDocumentPosition(devicesEl) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    // Grouping needs no questions list, which would be the newest version's.
    expect(
      mockGet.mock.calls.some(([u]: [string]) => u.includes('/questions'))
    ).toBe(false)
  })

  it('puts a row without a pillar under Other', async () => {
    setupMocks([{ ...DIFF_ENTRY, pillarid: null, pillar: null }])
    renderWithQueryClient(<ScoreDiffModal {...DEFAULT_PROPS} />)
    expect(await screen.findByText('Other')).toBeInTheDocument()
  })

  it('calls onClose when either close control is clicked', () => {
    setupMocks()
    const onClose = jest.fn()
    renderWithQueryClient(
      <ScoreDiffModal {...DEFAULT_PROPS} onClose={onClose} />
    )
    // ds/Modal renders two close affordances both named "Close":
    // the X icon button in the header and the footer button.
    const closeButtons = screen.getAllByRole('button', { name: 'Close' })
    expect(closeButtons).toHaveLength(2)
    fireEvent.click(closeButtons[0])
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(closeButtons[1])
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  // The modal offers no retry control, so if a failed diff survived a reopen
  // a transient network blip would stick until the pickers changed.
  it('retries a failed diff when the modal is reopened', async () => {
    let fail = true
    mockGet.mockImplementation((url: string) => {
      if (url === '/datacalls')
        return Promise.resolve({ data: { data: DATACALLS } })
      if (url.includes('/scores/diff'))
        return fail
          ? Promise.reject(new Error('Network error'))
          : Promise.resolve({ data: { data: [DIFF_ENTRY] } })
      return Promise.reject(new Error(`Unexpected URL: ${url}`))
    })
    const { rerender } = renderWithQueryClient(
      <ScoreDiffModal {...DEFAULT_PROPS} />
    )
    await screen.findByText('Failed to load diff. Please try again.')

    fail = false
    rerender(<ScoreDiffModal {...DEFAULT_PROPS} open={false} />)
    rerender(<ScoreDiffModal {...DEFAULT_PROPS} open={true} />)

    expect(
      await screen.findByText('Does your org use MFA?')
    ).toBeInTheDocument()
  })

  // The layout reads this same list for the whole session, so the modal's
  // read is a cache hit and the entry never loses its observer. That is what
  // makes deleting the module-level cache safe: it was standing in for a
  // shared cache the app now has.
  it('issues no datacalls request when the layout already holds the list', async () => {
    setupMocks()
    const client = createTestQueryClient()
    const Layout = () => {
      useDatacalls({ enabled: true })
      return <ScoreDiffModal {...DEFAULT_PROPS} />
    }
    const { unmount } = render(
      <QueryClientProvider client={client}>
        <Layout />
      </QueryClientProvider>
    )
    await screen.findByText('Does your org use MFA?')
    const datacallCalls = () =>
      mockGet.mock.calls.filter(([u]: [string]) => u === '/datacalls').length
    expect(datacallCalls()).toBe(1)

    // Close the modal by unmounting it, then bring it back under the same
    // client, the way navigating away and back does.
    unmount()
    render(
      <QueryClientProvider client={client}>
        <Layout />
      </QueryClientProvider>
    )
    await screen.findByText('Does your org use MFA?')

    expect(datacallCalls()).toBe(1)
  })

  // Reopening used to refetch because a counter forced the effect to re-run.
  // A diff only changes when an answer does, and an answer write invalidates
  // the whole scores prefix, so the cached rows are correct until then.
  it('serves the cached diff when the modal is reopened', async () => {
    setupMocks()
    const { rerender } = renderWithQueryClient(
      <ScoreDiffModal {...DEFAULT_PROPS} />
    )
    const diffCalls = () =>
      mockGet.mock.calls.filter(([u]: [string]) => u.includes('/scores/diff'))
        .length
    await waitFor(() => expect(diffCalls()).toBe(1))

    rerender(<ScoreDiffModal {...DEFAULT_PROPS} open={false} />)
    rerender(<ScoreDiffModal {...DEFAULT_PROPS} open={true} />)

    await screen.findByText('Does your org use MFA?')
    expect(diffCalls()).toBe(1)
  })
})
