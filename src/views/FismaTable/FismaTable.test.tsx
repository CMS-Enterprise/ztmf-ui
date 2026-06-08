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
  latestDataCallId: 42,
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

function renderFooter(selectedRows: number[]) {
  return render(
    <MemoryRouter>
      <CustomFooterSaveComponent {...baseProps} selectedRows={selectedRows} />
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
    expect(calledUrl).toContain('fsids=1')
    expect(calledUrl).toContain('fsids=2')
    // Must NOT be a bare export URL (no fsids = download everything)
    expect(calledUrl).not.toMatch(/\/export$/)
    expect(calledUrl).not.toMatch(/\/export\?$/)
  })
})
