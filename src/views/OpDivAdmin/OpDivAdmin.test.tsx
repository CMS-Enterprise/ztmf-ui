// Coverage for the Manage OpDivs "Add System Delegate Role" toggle and its
// role-based access (ztmf-ui#598). OWNER manages OpDivs fully; HHS admin
// reaches the page only to flip the delegate toggle; every other role is
// bounced. The toggle writes through the dedicated setOpDivDelegateEnabled
// endpoint, never the OWNER-only OpDiv update.

jest.mock('@/router/router', () => ({
  __esModule: true,
  default: { navigate: jest.fn() },
}))

// MUI DataGrid virtualizes rows and won't render them under jsdom. Stub it
// with a minimal grid that renders the toolbar plus, for each row, every
// column's renderCell / getActions output so the toggle Switch and the
// OWNER-only row actions are queryable.
jest.mock('@mui/x-data-grid', () => {
  const actual = jest.requireActual('@mui/x-data-grid')
  const react = require('react')
  return {
    ...actual,
    // GridToolbarContainer / QuickFilter need the real DataGrid context
    // (useGridRootProps); replace with plain passthroughs so the custom
    // CreateToolbar renders under the mocked grid below.
    GridToolbarContainer: (props: { children?: React.ReactNode }) =>
      react.createElement('div', null, props.children),
    GridToolbarQuickFilter: () => null,
    GridActionsCellItem: (props: { label?: string; onClick?: () => void }) =>
      react.createElement(
        'button',
        { type: 'button', 'aria-label': props.label, onClick: props.onClick },
        props.label
      ),
    DataGrid: (props: {
      rows?: Array<Record<string, unknown>>
      columns?: Array<Record<string, unknown>>
      getRowId?: (row: Record<string, unknown>) => string | number
      slots?: { toolbar?: (p: unknown) => React.ReactNode }
      slotProps?: { toolbar?: Record<string, unknown> }
    }) => {
      const { rows = [], columns = [], getRowId, slots, slotProps } = props
      const Toolbar = slots?.toolbar
      return react.createElement(
        'div',
        { 'data-testid': 'datagrid-mock' },
        Toolbar
          ? react.createElement(Toolbar, {
              key: 'toolbar',
              ...(slotProps?.toolbar ?? {}),
            })
          : null,
        rows.map((row) => {
          const id = getRowId ? getRowId(row) : (row.id as string | number)
          return react.createElement(
            'div',
            { key: String(id), 'data-testid': `row-${id}` },
            columns.map((col) => {
              const field = String(col.field)
              const getActions = col.getActions as
                | ((p: {
                    id: string | number
                    row: Record<string, unknown>
                  }) => React.ReactNode[])
                | undefined
              if (col.type === 'actions' && getActions) {
                return react.createElement(
                  'div',
                  { key: field },
                  getActions({ id, row })
                )
              }
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
              return null
            })
          )
        })
      )
    },
  }
})

jest.mock('@/utils/opdivs', () => ({
  __esModule: true,
  fetchOpDivs: jest.fn(),
  createOpDiv: jest.fn(),
  updateOpDiv: jest.fn(),
}))
jest.mock('@/utils/delegates', () => ({
  __esModule: true,
  setOpDivDelegateEnabled: jest.fn(),
}))
jest.mock('@/utils/notify', () => {
  const actual = jest.requireActual('@/utils/notify')
  return { ...actual, notify: jest.fn() }
})

const mockCtxListeners = new Set<() => void>()
let mockCtxValue: Record<string, unknown> = {}
function setMockCtx(next: Record<string, unknown>) {
  mockCtxValue = next
  mockCtxListeners.forEach((l) => l())
}
jest.mock('../Title/Context', () => ({
  useContextProp: () => {
    const react = require('react')
    return react.useSyncExternalStore(
      (cb: () => void) => {
        mockCtxListeners.add(cb)
        return () => mockCtxListeners.delete(cb)
      },
      () => mockCtxValue
    )
  },
}))

import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OpDivAdmin from './OpDivAdmin'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import { fetchOpDivs } from '@/utils/opdivs'
import { setOpDivDelegateEnabled } from '@/utils/delegates'
import type { OpDiv, UserRole, userData } from '@/types'

const fetchOpDivsMock = fetchOpDivs as jest.Mock
const setEnabledMock = setOpDivDelegateEnabled as jest.Mock

const EMPIRE: OpDiv = {
  opdiv_id: 3,
  code: 'EMPIRE',
  name: 'Galactic Empire',
  is_parent: false,
  active: true,
  system_delegate_enabled: false,
}

function ctx(role: UserRole) {
  return {
    userInfo: {
      userid: 'u-1',
      email: 'a@b.gov',
      fullname: 'Tester',
      role,
    } as userData,
  }
}

function renderAs(role: UserRole) {
  setMockCtx(ctx(role))
  return renderWithProviders(<OpDivAdmin />)
}

beforeEach(() => {
  jest.clearAllMocks()
  fetchOpDivsMock.mockResolvedValue([EMPIRE])
  setEnabledMock.mockResolvedValue({ ...EMPIRE, system_delegate_enabled: true })
})

test('OWNER sees the delegate toggle plus Create and row actions', async () => {
  renderAs('OWNER')

  expect(
    await screen.findByRole('checkbox', {
      name: /add system delegate role for empire/i,
    })
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: /create opdiv/i })
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: /deactivate/i })
  ).toBeInTheDocument()
})

test('HHS admin sees the grid and toggle but not Create / Edit / Deactivate', async () => {
  renderAs('HHS_ADMIN')

  expect(
    await screen.findByRole('checkbox', {
      name: /add system delegate role for empire/i,
    })
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: /create opdiv/i })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: /^edit$/i })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: /deactivate/i })
  ).not.toBeInTheDocument()
})

test('flipping the toggle confirms then calls the dedicated enable endpoint', async () => {
  const user = userEvent.setup()
  renderAs('OWNER')

  const toggle = await screen.findByRole('checkbox', {
    name: /add system delegate role for empire/i,
  })
  await user.click(toggle)

  // Nothing is written until the admin confirms.
  expect(setEnabledMock).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: /^enable$/i }))

  await waitFor(() => expect(setEnabledMock).toHaveBeenCalledTimes(1))
  // Toggled from false -> true for EMPIRE (opdiv_id 3).
  expect(setEnabledMock).toHaveBeenCalledWith(3, true)
})

test('cancelling the toggle confirmation writes nothing', async () => {
  const user = userEvent.setup()
  renderAs('OWNER')

  const toggle = await screen.findByRole('checkbox', {
    name: /add system delegate role for empire/i,
  })
  await user.click(toggle)
  await user.click(screen.getByRole('button', { name: /^cancel$/i }))

  expect(setEnabledMock).not.toHaveBeenCalled()
})

test('an OPDIV_ADMIN is bounced - no Manage OpDivs grid renders', () => {
  renderAs('OPDIV_ADMIN')

  expect(screen.queryByTestId('datagrid-mock')).not.toBeInTheDocument()
  expect(screen.queryByText(/manage opdivs/i)).not.toBeInTheDocument()
  expect(fetchOpDivsMock).not.toHaveBeenCalled()
})
