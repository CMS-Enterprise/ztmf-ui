import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { Routes as AppRoutes } from '@/router/constants'
import FismaTable from './FismaTable'
import type { userData } from '@/types'

// misc#382: the dashboard's Questionnaire button builds the URL that a refresh
// or a copied link later has to resolve on its own. It navigates with
// state: { fismasystemid } attached, which is what masked the unencoded-acronym
// bug — the id short-circuited resolution before the URL was ever read. So
// assert the path it writes, not just that the questionnaire opens.

// MUI DataGrid virtualizes rows and renders none under jsdom (no layout, no
// measured height). Same approach as UserTable.test / EventsTable.test, but
// FismaTable's Actions column is a renderCell rather than getActions, so the
// stub only needs to invoke that.
jest.mock('@mui/x-data-grid', () => {
  const actual = jest.requireActual('@mui/x-data-grid')
  const react = require('react')
  return {
    ...actual,
    // Needs the DataGrid context (useGridRootProps); a plain button renders
    // under the stubbed grid. forwardRef so the Tooltip wrappers can attach.
    GridActionsCellItem: react.forwardRef(
      (
        props: { label?: string; icon?: React.ReactNode; [k: string]: unknown },
        ref: React.Ref<HTMLButtonElement>
      ) => {
        const { icon: _icon, label, ...rest } = props
        return react.createElement(
          'button',
          { ...rest, ref, type: 'button', 'aria-label': label },
          label
        )
      }
    ),
    DataGrid: (props: {
      rows?: Array<Record<string, unknown>>
      columns?: Array<Record<string, unknown>>
      getRowId?: (row: Record<string, unknown>) => string | number
    }) => {
      const { rows = [], columns = [], getRowId } = props
      const actions = columns.find((c) => c.field === 'actions')
      const renderCell = actions?.renderCell as
        | ((p: Record<string, unknown>) => React.ReactNode)
        | undefined
      return react.createElement(
        'div',
        { 'data-testid': 'datagrid-mock' },
        rows.map((row) => {
          const id = getRowId ? getRowId(row) : (row.id as string | number)
          return react.createElement(
            'div',
            { key: String(id), 'data-testid': `row-${id}` },
            renderCell ? renderCell({ id, row, value: null }) : null
          )
        })
      )
    },
  }
})

jest.mock('@/axiosConfig', () => ({
  __esModule: true,
  default: { get: jest.fn().mockResolvedValue({ data: { data: [] } }) },
}))

let mockCtx: Record<string, unknown>
jest.mock('../Title/Context', () => ({
  useContextProp: () => mockCtx,
}))

const CALL = {
  datacallid: 5,
  datacall: 'Audit Fields Smoke Cycle',
  datecreated: '',
  deadline: '2099-12-31T23:59:59Z',
}

beforeEach(() => {
  jest.clearAllMocks()
  mockCtx = {
    userInfo: {
      userid: '1',
      email: 'grand.moff@deathstar.empire',
      fullname: 'Grand Moff Tarkin',
      role: 'OWNER',
    } as userData,
    fismaSystems: [
      {
        fismasystemid: 1003,
        fismaacronym: 'TIE/LN',
        fismaname: 'TIE Line Fighter Avionics',
        datacenterenvironment: 'Imperial-Fleet',
      },
    ],
    latestDataCallId: 5,
    selectedDatacall: CALL,
    datacalls: [CALL],
    activeDatacallIds: [5],
    datacenterEnvironments: [],
    opdivs: [],
  }
})

function renderDashboard() {
  const router = createMemoryRouter(
    [
      { path: '/', element: <FismaTable scores={{}} progress={{}} /> },
      { path: AppRoutes.QUESTIONNAIRE, element: <div>questionnaire</div> },
    ],
    { initialEntries: ['/'] }
  )
  return { router, ...render(<RouterProvider router={router} />) }
}

it('percent-encodes a slash-bearing acronym in the questionnaire URL it navigates to', async () => {
  const { router } = renderDashboard()

  await userEvent.click(
    await screen.findByRole('button', {
      name: /View Questionnaire for TIE Line Fighter Avionics/i,
    })
  )

  // Unencoded, this wrote /questionnaire/tie/ln — :fismaacronym captured "tie"
  // and "ln" landed in the :datacallid slot.
  await waitFor(() =>
    expect(router.state.location.pathname).toBe('/questionnaire/tie%2Fln')
  )
  // The id still rides along, so the dashboard flow itself never depends on the
  // URL resolving; the encoding is what makes refresh and copy-link work.
  expect(router.state.location.state).toMatchObject({ fismasystemid: 1003 })
})
