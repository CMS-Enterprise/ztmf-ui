import { buildExportUrl, exportSystemAnswers } from './exportSystems'

jest.mock('@/axiosConfig', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}))

const mockAxiosGet = require('@/axiosConfig').default.get as jest.Mock

const createObjectURL = jest.fn(() => 'blob:mock')
const revokeObjectURL = jest.fn()
Object.defineProperty(window, 'URL', {
  value: { createObjectURL, revokeObjectURL },
  writable: true,
})

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

describe('buildExportUrl', () => {
  it('returns a bare export URL when no system ids are given (export all)', () => {
    expect(buildExportUrl(42)).toBe('/datacalls/42/export')
    expect(buildExportUrl(42, [])).toBe('/datacalls/42/export')
  })

  it('appends a single fsids param for a partial selection', () => {
    expect(buildExportUrl(42, [1])).toBe('/datacalls/42/export?fsids=1')
  })

  it('appends every fsids param when several systems are selected (regression: #375)', () => {
    const url = buildExportUrl(42, [1, 2])
    expect(url).toContain('/datacalls/42/export')
    expect(url).toContain('fsids=1')
    expect(url).toContain('fsids=2')
    expect(url).not.toMatch(/\/export$/)
  })
})

describe('exportSystemAnswers', () => {
  it('requests the export as a blob and triggers a download', async () => {
    await exportSystemAnswers(42)
    expect(mockAxiosGet).toHaveBeenCalledWith(
      '/datacalls/42/export',
      expect.objectContaining({ responseType: 'blob' })
    )
    expect(createObjectURL).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalled()
  })

  it('scopes the export to the given system ids', async () => {
    await exportSystemAnswers(7, [3, 4])
    const calledUrl: string = mockAxiosGet.mock.calls[0][0]
    expect(calledUrl).toContain('/datacalls/7/export')
    expect(calledUrl).toContain('fsids=3')
    expect(calledUrl).toContain('fsids=4')
  })
})
