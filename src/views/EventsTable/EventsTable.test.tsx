// Coverage for the admin events view (ui#711): the unscoped-read gate (the
// three tiers the endpoint allows render; scoped tiers bounce), the mapping
// from filter state to GET /events query params, and server-side page math.

jest.mock('@/router/router', () => ({
  __esModule: true,
  default: { navigate: jest.fn() },
}))

// MUI DataGrid virtualizes rows and won't render them under jsdom. Stub it
// with a minimal grid exposing the server-pagination props under test and
// each row's rendered cells.
jest.mock('@mui/x-data-grid', () => {
  const actual = jest.requireActual('@mui/x-data-grid')
  const react = require('react')
  return {
    ...actual,
    DataGrid: (props: {
      rows?: Array<Record<string, unknown>>
      columns?: Array<Record<string, unknown>>
      getRowId?: (row: Record<string, unknown>) => string | number
      rowCount?: number
      paginationModel?: { page: number; pageSize: number }
      onPaginationModelChange?: (m: { page: number; pageSize: number }) => void
      loading?: boolean
    }) => {
      const { rows = [], columns = [], getRowId } = props
      return react.createElement(
        'div',
        {
          'data-testid': 'datagrid-mock',
          'data-rowcount': String(props.rowCount ?? ''),
          'data-page': String(props.paginationModel?.page ?? ''),
          'data-pagesize': String(props.paginationModel?.pageSize ?? ''),
        },
        react.createElement(
          'button',
          {
            type: 'button',
            onClick: () =>
              props.onPaginationModelChange?.({
                page: (props.paginationModel?.page ?? 0) + 1,
                pageSize: props.paginationModel?.pageSize ?? 50,
              }),
          },
          'next page'
        ),
        rows.map((row) => {
          const id = getRowId ? getRowId(row) : (row.id as string | number)
          return react.createElement(
            'div',
            { key: String(id), 'data-testid': `row-${id}` },
            columns.map((col) => {
              const field = String(col.field)
              const renderCell = col.renderCell as
                | ((p: {
                    row: Record<string, unknown>
                    id: string | number
                    value: unknown
                  }) => React.ReactNode)
                | undefined
              if (renderCell) {
                return react.createElement(
                  'div',
                  { key: field },
                  renderCell({ row, id, value: row[field] })
                )
              }
              return react.createElement(
                'div',
                { key: field },
                String(row[field] ?? '')
              )
            })
          )
        })
      )
    },
  }
})

jest.mock('@/axiosConfig', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}))
jest.mock('@/utils/notify', () => {
  const actual = jest.requireActual('@/utils/notify')
  return { ...actual, notify: jest.fn() }
})

const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

let mockCtxValue: Record<string, unknown> = {}
jest.mock('../Title/Context', () => ({
  useContextProp: () => mockCtxValue,
}))

import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EventsTable from './EventsTable'
import axiosInstance from '@/axiosConfig'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import type { EventsPage, UserRole } from '@/types'

const getMock = axiosInstance.get as jest.Mock

const PAGE: EventsPage = {
  events: [
    {
      eventid: 42,
      userid: 'uuid-1',
      action: 'updated',
      type: 'public.scores',
      createdat: '2026-08-20T12:00:00Z',
      payload: {},
      userfullname: 'Grand Moff Tarkin',
      useremail: 'Grand.Moff@DeathStar.Empire',
      userdeleted: false,
    },
    {
      eventid: 43,
      userid: 'uuid-2',
      action: 'created',
      type: 'session',
      createdat: '2026-08-20T11:00:00Z',
      payload: {},
      userfullname: 'Retired Officer',
      useremail: 'retired.officer@empire.test',
      userdeleted: true,
    },
  ],
  total: 120,
  limit: 50,
  offset: 0,
}

function mockApi() {
  getMock.mockImplementation((url: string) => {
    if (url === '/users') {
      return Promise.resolve({
        data: {
          data: [
            {
              userid: 'uuid-1',
              fullname: 'Grand Moff Tarkin',
              email: 'Grand.Moff@DeathStar.Empire',
              role: 'OWNER',
            },
          ],
        },
      })
    }
    return Promise.resolve({ data: { data: PAGE } })
  })
}

function renderFor(role: UserRole | '') {
  mockCtxValue = {
    userInfo: { userid: 'me', role, fullname: 'Me', email: 'me@x.test' },
    fismaSystems: [
      { fismasystemid: 7, fismaacronym: 'DSTR', fismaname: 'Death Star' },
    ],
  }
  return renderWithProviders(<EventsTable />)
}

// The last GET /events call's params, ignoring interleaved /users fetches.
function lastEventsParams(): Record<string, unknown> {
  const calls = getMock.mock.calls.filter(([url]) => url === '/events')
  return calls[calls.length - 1][1].params
}

beforeEach(() => {
  jest.clearAllMocks()
  mockApi()
})

describe('access gate', () => {
  it.each(['OWNER', 'HHS_ADMIN', 'HHS_READONLY_ADMIN'] as UserRole[])(
    'renders the audit trail for %s',
    async (role) => {
      renderFor(role)
      expect(await screen.findByText('Grand Moff Tarkin')).toBeInTheDocument()
      expect(mockNavigate).not.toHaveBeenCalled()
    }
  )

  it.each(['OPDIV_ADMIN', 'OPDIV_READONLY_ADMIN', 'ISSO'] as UserRole[])(
    'bounces %s to the dashboard without fetching',
    async (role) => {
      renderFor(role)
      await waitFor(() =>
        expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
      )
      expect(getMock).not.toHaveBeenCalled()
    }
  )
})

describe('rendering', () => {
  it('marks a soft-deleted initiating user', async () => {
    renderFor('OWNER')
    expect(
      await screen.findByText('Retired Officer (deleted)')
    ).toBeInTheDocument()
    expect(screen.getByText('retired.officer@empire.test')).toBeInTheDocument()
  })

  it('feeds the server total to the grid, not the page length', async () => {
    renderFor('OWNER')
    await screen.findByText('Grand Moff Tarkin')
    expect(screen.getByTestId('datagrid-mock')).toHaveAttribute(
      'data-rowcount',
      '120'
    )
  })
})

describe('query params', () => {
  it('requests the backend default page on load, with no filters', async () => {
    renderFor('OWNER')
    await screen.findByText('Grand Moff Tarkin')
    expect(lastEventsParams()).toEqual({ limit: 50, offset: 0 })
  })

  it('maps a page change to the matching offset', async () => {
    renderFor('OWNER')
    await screen.findByText('Grand Moff Tarkin')
    await userEvent.click(screen.getByRole('button', { name: 'next page' }))
    await waitFor(() =>
      expect(lastEventsParams()).toEqual({ limit: 50, offset: 50 })
    )
  })

  it('maps the action filter and resets to the first page', async () => {
    renderFor('OWNER')
    await screen.findByText('Grand Moff Tarkin')
    await userEvent.click(screen.getByRole('button', { name: 'next page' }))
    await waitFor(() => expect(lastEventsParams().offset).toBe(50))
    await userEvent.click(screen.getByLabelText('Action'))
    await userEvent.click(await screen.findByRole('option', { name: 'viewed' }))
    await waitFor(() =>
      expect(lastEventsParams()).toEqual({
        limit: 50,
        offset: 0,
        action: 'viewed',
      })
    )
  })

  it('maps a complete date range to RFC3339 day bounds', async () => {
    renderFor('OWNER')
    await screen.findByText('Grand Moff Tarkin')
    await userEvent.type(screen.getByLabelText('From'), '06301991')
    await userEvent.type(screen.getByLabelText('To'), '07011991')
    await waitFor(() => {
      const params = lastEventsParams()
      expect(params.from).toBe(new Date(1991, 5, 30, 0, 0, 0, 0).toISOString())
      expect(params.to).toBe(
        new Date(1991, 6, 1, 23, 59, 59, 999).toISOString()
      )
    })
  })

  it('masks slashes into the date field as the user types', async () => {
    renderFor('OWNER')
    await screen.findByText('Grand Moff Tarkin')
    const from = screen.getByLabelText('From')
    await userEvent.type(from, '06301991')
    expect(from).toHaveValue('06/30/1991')
  })

  it('never sends an impossible date, and flags it', async () => {
    renderFor('OWNER')
    await screen.findByText('Grand Moff Tarkin')
    const callsBefore = getMock.mock.calls.filter(
      ([url]) => url === '/events'
    ).length
    await userEvent.type(screen.getByLabelText('From'), '02302026')
    expect(await screen.findByText('Invalid date')).toBeInTheDocument()
    const callsAfter = getMock.mock.calls.filter(
      ([url]) => url === '/events'
    ).length
    const paramsSinceTyping = getMock.mock.calls
      .filter(([url]) => url === '/events')
      .slice(callsBefore, callsAfter)
      .map(([, cfg]) => cfg.params)
    expect(paramsSinceTyping.every((p) => p.from === undefined)).toBe(true)
  })
})
