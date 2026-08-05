import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CustomFooterSaveComponent } from './FismaTable'
import type { FismaSystemType } from '@/types'

// GridFooterContainer and GridFooter internally call useGridRootProps which
// requires the MUI DataGrid context. Stub them out for isolated unit tests.
jest.mock('@mui/x-data-grid', () => ({
  ...jest.requireActual('@mui/x-data-grid'),
  GridFooterContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  GridFooter: () => <div data-testid="grid-footer" />,
}))

jest.mock('@/axiosConfig', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}))

const mockAxiosGet = require('@/axiosConfig').default.get as jest.Mock

// Minimal blob download stubs
const createObjectURL = jest.fn(() => 'blob:mock')
const revokeObjectURL = jest.fn()
Object.defineProperty(window, 'URL', {
  value: { createObjectURL, revokeObjectURL },
  writable: true,
})

const SYSTEMS = [
  { fismasystemid: 1, fismaname: 'Active A' },
  { fismasystemid: 2, fismaname: 'Active B' },
]

const baseProps = {
  fismaSystems: SYSTEMS as unknown as FismaSystemType[],
  activeDataCallId: 42,
  scores: {},
}

const blobResponse = {
  headers: {
    'content-disposition': 'attachment; filename=export.xlsx',
    'content-type':
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  data: new Blob(),
}

beforeEach(() => {
  jest.clearAllMocks()
  mockAxiosGet.mockResolvedValue(blobResponse)
})

function renderFooter(
  selectedRows: number[],
  extra: {
    systemCallMap?: Record<number, number[]>
    chosenCallMap?: Record<number, number>
  } = {}
) {
  return render(
    <MemoryRouter>
      <CustomFooterSaveComponent
        {...baseProps}
        {...extra}
        selectedRows={selectedRows}
      />
    </MemoryRouter>
  )
}

describe('CustomFooterSaveComponent download button', () => {
  it('is disabled when no rows are selected', () => {
    renderFooter([])
    expect(
      screen.getByRole('button', { name: /download selected system answers/i })
    ).toBeDisabled()
  })

  it('sends fsids for a partial selection', () => {
    renderFooter([1])
    fireEvent.click(
      screen.getByRole('button', { name: /download selected system answers/i })
    )
    expect(mockAxiosGet).toHaveBeenCalledWith(
      expect.stringContaining('fsids=1'),
      expect.objectContaining({ responseType: 'blob' })
    )
  })

  it('sends fsids when all visible rows are selected (regression: #375 select-all bug)', () => {
    // Before the fix: selectedRows.length === fismaSystems.length caused the
    // condition to short-circuit, sending no fsids and downloading all systems
    // including those from the opposite decommissioned/active view.
    renderFooter([1, 2])
    fireEvent.click(
      screen.getByRole('button', { name: /download selected system answers/i })
    )
    const calledUrl: string = mockAxiosGet.mock.calls[0][0]
    // Exports against the active datacall (selected or latest), not a stale id
    expect(calledUrl).toContain('/datacalls/42/export')
    expect(calledUrl).toContain('fsids=1')
    expect(calledUrl).toContain('fsids=2')
    // Must NOT be a bare export URL (no fsids = download everything)
    expect(calledUrl).not.toMatch(/\/export$/)
    expect(calledUrl).not.toMatch(/\/export\?$/)
  })

  it('targets a not-started system displayed call, not the active call', () => {
    // A not-started system has no score-derived call (empty systemCallMap), but
    // the dashboard shows it against call 7 (a past-year view). The export must
    // target 7, not the active call 42 - otherwise a past-year export silently
    // hits the wrong call once the backend starts returning rows for it.
    renderFooter([3], { systemCallMap: {}, chosenCallMap: { 3: 7 } })
    fireEvent.click(
      screen.getByRole('button', { name: /download selected system answers/i })
    )
    const calledUrl: string = mockAxiosGet.mock.calls[0][0]
    expect(calledUrl).toContain('/datacalls/7/export')
    expect(calledUrl).not.toContain('/datacalls/42/export')
    expect(calledUrl).toContain('fsids=3')
  })

  it('disables export when selected rows display different calls', () => {
    // Two never-started rows shown against different calls have no single
    // export target, so the button stays disabled rather than guessing.
    renderFooter([3, 4], { systemCallMap: {}, chosenCallMap: { 3: 7, 4: 9 } })
    expect(
      screen.getByRole('button', { name: /download selected system answers/i })
    ).toBeDisabled()
  })

  it('targets a scored system score-derived call', () => {
    // A scored system resolves through systemCallMap (calls it has scores in),
    // not the chosen-call fallback. Pins that the not-started fallback did not
    // displace the original path.
    renderFooter([1], { systemCallMap: { 1: [7] } })
    fireEvent.click(
      screen.getByRole('button', { name: /download selected system answers/i })
    )
    const calledUrl: string = mockAxiosGet.mock.calls[0][0]
    expect(calledUrl).toContain('/datacalls/7/export')
    expect(calledUrl).toContain('fsids=1')
  })

  it('exports a mixed scored + not-started selection sharing one call', () => {
    // Scored system 1 has a score in call 7; not-started system 3 is displayed
    // against call 7. They share one target, so export goes to call 7 with both
    // ids rather than disabling or splitting.
    renderFooter([1, 3], {
      systemCallMap: { 1: [7] },
      chosenCallMap: { 3: 7 },
    })
    fireEvent.click(
      screen.getByRole('button', { name: /download selected system answers/i })
    )
    const calledUrl: string = mockAxiosGet.mock.calls[0][0]
    expect(calledUrl).toContain('/datacalls/7/export')
    expect(calledUrl).toContain('fsids=1')
    expect(calledUrl).toContain('fsids=3')
  })
})
