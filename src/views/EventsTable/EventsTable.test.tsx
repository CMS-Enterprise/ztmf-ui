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

// The MUI DatePicker renders a masked, calendar-backed field that is awkward
// to drive under jsdom. Stub it with a plain date input so the tests exercise
// the filter-to-query mapping, not MUI's picker internals - the same approach
// taken for the DataGrid above.
jest.mock('@mui/x-date-pickers/LocalizationProvider', () => ({
  LocalizationProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}))
jest.mock('@mui/x-date-pickers/AdapterDateFnsV3', () => ({
  AdapterDateFns: class {},
}))
jest.mock('@mui/x-date-pickers/DatePicker', () => {
  const react = require('react')
  return {
    DatePicker: (props: {
      onChange?: (d: Date | null) => void
      slotProps?: { textField?: { inputProps?: { 'aria-label'?: string } } }
    }) =>
      react.createElement('input', {
        type: 'date',
        'aria-label': props.slotProps?.textField?.inputProps?.['aria-label'],
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
          const v = e.target.value
          // Parse the ISO date as local midnight, matching what the real
          // adapter yields for a day selection.
          props.onChange?.(v ? new Date(`${v}T00:00:00`) : null)
        },
      }),
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

import { fireEvent, screen, waitFor } from '@testing-library/react'
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

  it('shows friendly resource and action labels, not raw values', async () => {
    renderFor('OWNER')
    await screen.findByText('Grand Moff Tarkin')
    // The row's type "public.scores" renders as "Score" and its action
    // "updated" as "Updated"; neither raw value appears.
    expect(screen.getByText('Score')).toBeInTheDocument()
    expect(screen.getByText('Updated')).toBeInTheDocument()
    expect(screen.queryByText('public.scores')).not.toBeInTheDocument()
    expect(screen.queryByText('updated')).not.toBeInTheDocument()
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

  it('clears every active filter and refetches the default page', async () => {
    renderFor('OWNER')
    await screen.findByText('Grand Moff Tarkin')
    const clear = screen.getByRole('button', { name: /clear filters/i })
    // Nothing set yet, so the control is inert.
    expect(clear).toBeDisabled()
    await userEvent.click(screen.getByLabelText('Action'))
    await userEvent.click(await screen.findByRole('option', { name: 'Viewed' }))
    await waitFor(() => expect(lastEventsParams().action).toBe('viewed'))
    await userEvent.click(clear)
    await waitFor(() =>
      expect(lastEventsParams()).toEqual({ limit: 50, offset: 0 })
    )
  })

  it('maps the action filter and resets to the first page', async () => {
    renderFor('OWNER')
    await screen.findByText('Grand Moff Tarkin')
    await userEvent.click(screen.getByRole('button', { name: 'next page' }))
    await waitFor(() => expect(lastEventsParams().offset).toBe(50))
    await userEvent.click(screen.getByLabelText('Action'))
    await userEvent.click(await screen.findByRole('option', { name: 'Viewed' }))
    await waitFor(() =>
      expect(lastEventsParams()).toEqual({
        limit: 50,
        offset: 0,
        action: 'viewed',
      })
    )
  })

  it('maps a picked date range to RFC3339 day bounds', async () => {
    renderFor('OWNER')
    await screen.findByText('Grand Moff Tarkin')
    // The stubbed picker takes an ISO value; the real one yields the same Date.
    fireEvent.change(screen.getByLabelText('From'), {
      target: { value: '1991-06-30' },
    })
    fireEvent.change(screen.getByLabelText('To'), {
      target: { value: '1991-07-01' },
    })
    await waitFor(() => {
      const params = lastEventsParams()
      expect(params.from).toBe(new Date(1991, 5, 30, 0, 0, 0, 0).toISOString())
      expect(params.to).toBe(
        new Date(1991, 6, 1, 23, 59, 59, 999).toISOString()
      )
    })
  })

  it('resets to the first page when a date bound changes', async () => {
    renderFor('OWNER')
    await screen.findByText('Grand Moff Tarkin')
    await userEvent.click(screen.getByRole('button', { name: 'next page' }))
    await waitFor(() => expect(lastEventsParams().offset).toBe(50))
    fireEvent.change(screen.getByLabelText('From'), {
      target: { value: '1991-06-30' },
    })
    await waitFor(() => expect(lastEventsParams().offset).toBe(0))
  })
})
