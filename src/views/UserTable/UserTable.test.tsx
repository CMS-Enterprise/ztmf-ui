// Regression coverage for UserTable's global fisma-system label fetches. The
// active + decommissioned lists are fetched here from dedicated /fismasystems
// reads rather than context.fismaSystems, which the dashboard's Show
// Decommissioned toggle would otherwise swap to the decommissioned-only
// response. These lists are label sources; the picker's selectable options
// come from a per-user /users/:id/assignablefismasystems read inside the modal
// See AssignSystemModal.test.tsx for the picker-rendering
// assertions.

jest.mock('@/router/router', () => ({
  __esModule: true,
  default: { navigate: jest.fn() },
}))

// MUI DataGrid virtualizes rows and won't render them under jsdom (no
// layout, no measured height). Stub it with a minimal implementation
// that renders each row's action column so the Assign Systems row action
// is clickable in tests. GridActionsCellItem needs the DataGrid context
// (useGridRootProps), so it's stubbed as a plain button too. Everything
// else in the DataGrid API is passed through from the real module.
jest.mock('@mui/x-data-grid', () => {
  const actual = jest.requireActual('@mui/x-data-grid')
  const react = require('react')
  return {
    ...actual,
    // The toolbar internals call useGridRootProps, which only works inside a
    // real DataGrid; stub them so EditToolbar renders under the mock.
    GridToolbarContainer: ({ children }: { children: React.ReactNode }) =>
      react.createElement('div', null, children),
    GridToolbarQuickFilter: () =>
      react.createElement('input', { 'aria-label': 'quick-filter' }),
    // GridActionsCellItem uses useGridRootProps and only works inside a
    // real DataGrid. Replace it with a plain button so it renders under
    // our mocked DataGrid below.
    GridActionsCellItem: (props: {
      icon?: React.ReactNode
      label?: string
      onClick?: () => void
      disabled?: boolean
    }) =>
      react.createElement(
        'button',
        {
          type: 'button',
          'aria-label': props.label,
          onClick: props.onClick,
          disabled: props.disabled,
        },
        props.label
      ),
    // Minimal DataGrid that renders the toolbar slot and each row's action
    // column, populates apiRef, and captures processRowUpdate so a test can
    // drive the create/edit save without simulating the inline-edit commit.
    DataGrid: (props: {
      rows?: Array<Record<string, unknown>>
      columns?: Array<Record<string, unknown>>
      getRowId?: (row: Record<string, unknown>) => string | number
      apiRef?: {
        current: Record<string, unknown> | null
      }
      processRowUpdate?: (row: Record<string, unknown>) => unknown
      isCellEditable?: (p: {
        field: string
        row: Record<string, unknown>
      }) => boolean
      slots?: { toolbar?: (p: Record<string, unknown>) => React.ReactNode }
      slotProps?: { toolbar?: Record<string, unknown> }
    }) => {
      const { rows = [], columns = [], getRowId } = props
      mockGrid.processRowUpdate = props.processRowUpdate
      // Run the cell-editability gate so its predicate is exercised.
      rows.forEach((row) =>
        columns.forEach((col) =>
          props.isCellEditable?.({ field: col.field as string, row })
        )
      )
      if (props.apiRef) {
        props.apiRef.current = {
          getRow: (id: string | number) =>
            rows.find((r) => (getRowId ? getRowId(r) : r.id) === id),
          getRowWithUpdatedValues: (id: string | number) =>
            rows.find((r) => (getRowId ? getRowId(r) : r.id) === id),
          updateRows: () => {},
        }
      }
      const Toolbar = props.slots?.toolbar
      return react.createElement(
        'div',
        { 'data-testid': 'datagrid-mock' },
        Toolbar
          ? react.createElement(Toolbar, {
              key: 'toolbar',
              ...(props.slotProps?.toolbar ?? {}),
            })
          : null,
        rows.map((row) => {
          const id = getRowId ? getRowId(row) : (row.id as string | number)
          return react.createElement(
            'div',
            { key: String(id), 'data-testid': `datagrid-row-${id}` },
            columns.map((col) => {
              const getActions = col.getActions as
                | ((params: {
                    id: string | number
                    row: Record<string, unknown>
                  }) => React.ReactNode[])
                | undefined
              if (col.type === 'actions' && getActions) {
                return react.createElement(
                  'div',
                  { key: String(col.field) },
                  getActions({ id, row })
                )
              }
              // Exercise each column's valueGetter/renderCell so the column
              // definitions (labels, OpDiv chips, last-seen formatting) run.
              const field = col.field as string
              const valueGetter = col.valueGetter as
                | ((p: unknown) => unknown)
                | undefined
              const renderCell = col.renderCell as
                | ((p: unknown) => React.ReactNode)
                | undefined
              const value = valueGetter
                ? valueGetter({ row, id, value: row[field] })
                : row[field]
              return react.createElement(
                'div',
                { key: field },
                renderCell ? renderCell({ row, id, value, field }) : null
              )
            })
          )
        })
      )
    },
  }
})

// Captures the live processRowUpdate handler from the mocked DataGrid so tests
// can invoke the create/edit save path directly (the inline-edit commit that
// would call it is not simulated by the minimal grid).
const mockGrid: {
  processRowUpdate?: (row: Record<string, unknown>) => unknown
} = {}

jest.mock('@/utils/config', () => ({
  __esModule: true,
  default: { IDP_ENABLED: false },
}))

// OpDiv grant writes/reads during create-with-grants and row refresh.
jest.mock('@/utils/userOpdivs', () => ({
  __esModule: true,
  setUserOpDivs: jest.fn().mockResolvedValue(undefined),
  fetchUserOpDivs: jest.fn().mockResolvedValue([]),
}))
const setUserOpDivs = require('@/utils/userOpdivs').setUserOpDivs as jest.Mock

// notify drives the delete/restore snackbars; mock it to assert calls.
// isAuthHandled must stay a real-ish predicate (false for ordinary errors) so
// the fetch tests' catch branches still log rather than short-circuit.
jest.mock('@/utils/notify', () => ({
  __esModule: true,
  notify: jest.fn(),
  isAuthHandled: jest.fn(() => false),
}))
const notify = require('@/utils/notify').notify as jest.Mock

jest.mock('@/axiosConfig', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}))
const axios = require('@/axiosConfig').default as {
  get: jest.Mock
  post: jest.Mock
  put: jest.Mock
  delete: jest.Mock
}

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

import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UserTable from './UserTable'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import type { FismaSystemType, userData, users } from '@/types'

const ACTIVE_SYSTEMS: FismaSystemType[] = [
  {
    fismasystemid: 1001,
    fismaacronym: 'DS-1',
    fismaname: 'Death Star',
    fismasubsystem: null,
  } as unknown as FismaSystemType,
  {
    fismasystemid: 1101,
    fismaacronym: 'ISD-CHI',
    fismaname: 'Star Destroyer Chimaera',
    fismasubsystem: null,
  } as unknown as FismaSystemType,
]

function makeCtx(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    userInfo: {
      userid: 'u-1',
      email: 'grand.moff@deathstar.empire',
      fullname: 'Grand Moff Tarkin',
      role: 'OWNER',
    } as userData,
    // Poison context with a decommissioned-only entry that mimics the
    // dashboard toggle. The fix must ignore this array entirely.
    fismaSystems: [
      {
        fismasystemid: 9001,
        fismaacronym: 'DECOM-A',
        fismaname: 'Decommissioned System A',
        fismasubsystem: null,
        decommissioned: true,
      },
    ] as unknown as FismaSystemType[],
    showDecommissioned: true,
    setShowDecommissioned: jest.fn(),
    setFismaSystems: jest.fn(),
    fetchFismaSystems: jest.fn(),
    datacenterEnvironments: [],
    // OpDivs arrive on the shared Outlet context; UserTable reads
    // them for its OpDiv derivations, so an undefined value would throw.
    opdivs: [],
    opdivsLoaded: true,
    latestDataCallId: 0,
    latestDatacall: '',
    latestDeadline: '',
    selectedDatacall: null,
    datacalls: [],
    activeDatacallIds: [],
    ...overrides,
  }
}

function fismaSystemsCalls(): string[] {
  return axios.get.mock.calls
    .map((c: unknown[]) => c[0])
    .filter(
      (u: unknown): u is string =>
        typeof u === 'string' && u.startsWith('/fismasystems')
    )
}

beforeEach(() => {
  jest.clearAllMocks()
  setMockCtx(makeCtx())
  axios.get.mockReset()
  axios.post.mockReset()
  axios.put.mockReset()
  axios.delete.mockReset()
})

test('fetches both /fismasystems and /fismasystems?decommissioned=true regardless of context', async () => {
  // The picker map needs both active and decommissioned systems so the
  // modal can render a labeled chip (with a "(Decommissioned)" suffix)
  // for an assignment to a system that was later retired. Both fetches
  // fire from UserTable directly, so the dashboard's Show Decommissioned
  // toggle (truthy in makeCtx()) has no bearing on which endpoints hit.
  axios.get.mockImplementation((url: string) => {
    if (url.startsWith('/users'))
      return Promise.resolve({ status: 200, data: { data: [] } })
    if (url === '/fismasystems')
      return Promise.resolve({ status: 200, data: { data: ACTIVE_SYSTEMS } })
    if (url === '/fismasystems?decommissioned=true')
      return Promise.resolve({ status: 200, data: { data: [] } })
    return Promise.resolve({ status: 200, data: { data: [] } })
  })

  renderWithProviders(<UserTable />)

  await waitFor(() => expect(fismaSystemsCalls()).toContain('/fismasystems'))
  await waitFor(() =>
    expect(fismaSystemsCalls()).toContain('/fismasystems?decommissioned=true')
  )
})

test('does not fetch /fismasystems when the user has no admin-read access', async () => {
  // ISSO role is not admin-tier, so canRead is false and the picker fetch
  // must not fire (nothing to render an admin-only picker for).
  setMockCtx(
    makeCtx({
      userInfo: {
        userid: 'u-2',
        email: 'piett@example',
        fullname: 'Piett',
        role: 'ISSO',
      } as userData,
    })
  )
  axios.get.mockResolvedValue({ status: 200, data: { data: [] } })

  renderWithProviders(<UserTable />)

  // Give any queued effects a chance to fire before asserting the negative.
  await new Promise((r) => setTimeout(r, 20))
  expect(fismaSystemsCalls()).toHaveLength(0)
})

test('decommissioned fetch failure degrades gracefully: active systems still populate the picker', async () => {
  // Partial-failure path. Promise.allSettled decouples the two fetches -
  // a decommissioned-endpoint failure must NOT block the primary active
  // fetch, which is the picker's source of truth for assignable systems.
  // Regression: reverting to Promise.all - OR returning early after the
  // warn without calling setFismaSystemsMap - would blank the picker
  // entirely, recreating the original context-poisoning symptom (admin
  // sees zero systems to assign).
  //
  // Assertion drives the modal open and inspects the picker options, so
  // it fails if setFismaSystemsMap is skipped (empty map -> empty
  // Autocomplete). Logging assertions are secondary.
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const user = userEvent.setup()
  const piett: users = {
    userid: '22222222-2222-2222-2222-222222222222',
    email: 'Admiral.Piett@executor.empire',
    fullname: 'Admiral Piett',
    role: 'ISSO',
    assignedfismasystems: [],
    assignedopdivids: [],
  }
  axios.get.mockImplementation((url: string) => {
    if (url === '/users' || url.startsWith('/users?'))
      return Promise.resolve({ status: 200, data: { data: [piett] } })
    if (url === '/fismasystems')
      return Promise.resolve({ status: 200, data: { data: ACTIVE_SYSTEMS } })
    if (url === '/fismasystems?decommissioned=true')
      return Promise.reject(new Error('backend 500'))
    // The picker's selectable options come from the per-user assignable
    // endpoint; allSystems is only a label source now.
    if (url.includes('/assignablefismasystems'))
      return Promise.resolve({ status: 200, data: { data: ACTIVE_SYSTEMS } })
    if (url.includes('/assignedfismasystems'))
      return Promise.resolve({ status: 200, data: { data: [] } })
    return Promise.resolve({ status: 200, data: { data: [] } })
  })

  renderWithProviders(<UserTable />)

  // Both endpoints were attempted (parallel fetch fired).
  await waitFor(() =>
    expect(fismaSystemsCalls()).toContain('/fismasystems?decommissioned=true')
  )
  expect(fismaSystemsCalls()).toContain('/fismasystems')

  // Open the Assign Systems modal for Piett so the picker renders with
  // the map that (should) have been populated from the active response.
  const assignBtn = await screen.findByRole('button', {
    name: 'assignedSystems',
  })
  await user.click(assignBtn)

  // Click into the Autocomplete to expand the dropdown, then assert an
  // active system's option is present. If setFismaSystemsMap was skipped,
  // the map is {}, the picker has zero options, and this findByText
  // times out.
  const combobox = await screen.findByRole('combobox', {
    name: /assign fisma systems/i,
  })
  await user.click(combobox)
  await waitFor(() =>
    expect(screen.getByText(/DS-1\s*-\s*Death Star/i)).toBeInTheDocument()
  )
  expect(
    screen.getByText(/ISD-CHI\s*-\s*Star Destroyer Chimaera/i)
  ).toBeInTheDocument()

  // Secondary: the graceful-degradation warning fired.
  expect(warn).toHaveBeenCalledWith(
    expect.stringContaining('Fetch decommissioned fisma systems failed'),
    expect.any(Error)
  )
  warn.mockRestore()
})

test('decommissioned fetch fulfilled with data:null still populates the picker from active', async () => {
  // Fulfilled sibling of the rejection path. `?? []` in the loader
  // normalizes the null payload; dropping it would blow up the mapper's
  // for-of and blank the picker.
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const err = jest.spyOn(console, 'error').mockImplementation(() => {})
  const user = userEvent.setup()
  const piett: users = {
    userid: '22222222-2222-2222-2222-222222222222',
    email: 'Admiral.Piett@executor.empire',
    fullname: 'Admiral Piett',
    role: 'ISSO',
    assignedfismasystems: [],
    assignedopdivids: [],
  }
  axios.get.mockImplementation((url: string) => {
    if (url === '/users' || url.startsWith('/users?'))
      return Promise.resolve({ status: 200, data: { data: [piett] } })
    if (url === '/fismasystems')
      return Promise.resolve({ status: 200, data: { data: ACTIVE_SYSTEMS } })
    if (url === '/fismasystems?decommissioned=true')
      return Promise.resolve({ status: 200, data: { data: null } })
    // Picker options come from the per-user assignable endpoint.
    if (url.includes('/assignablefismasystems'))
      return Promise.resolve({ status: 200, data: { data: ACTIVE_SYSTEMS } })
    if (url.includes('/assignedfismasystems'))
      return Promise.resolve({ status: 200, data: { data: [] } })
    return Promise.resolve({ status: 200, data: { data: [] } })
  })

  renderWithProviders(<UserTable />)

  await waitFor(() =>
    expect(fismaSystemsCalls()).toContain('/fismasystems?decommissioned=true')
  )
  expect(fismaSystemsCalls()).toContain('/fismasystems')

  const assignBtn = await screen.findByRole('button', {
    name: 'assignedSystems',
  })
  await user.click(assignBtn)
  const combobox = await screen.findByRole('combobox', {
    name: /assign fisma systems/i,
  })
  await user.click(combobox)
  await waitFor(() =>
    expect(screen.getByText(/DS-1\s*-\s*Death Star/i)).toBeInTheDocument()
  )

  // Fulfilled path: no graceful-degradation warn, no critical error.
  expect(warn).not.toHaveBeenCalledWith(
    expect.stringContaining('Fetch decommissioned fisma systems failed'),
    expect.anything()
  )
  const criticalErrors = err.mock.calls.filter((c) =>
    c.some(
      (arg) =>
        typeof arg === 'string' &&
        arg.includes('Fetch active fisma systems error')
    )
  )
  expect(criticalErrors).toHaveLength(0)
  warn.mockRestore()
  err.mockRestore()
})

test('fetch error is swallowed without crashing the table', async () => {
  const err = jest.spyOn(console, 'error').mockImplementation(() => {})
  axios.get.mockImplementation((url: string) => {
    if (url.startsWith('/users'))
      return Promise.resolve({ status: 200, data: { data: [] } })
    if (url === '/fismasystems') return Promise.reject(new Error('boom'))
    return Promise.resolve({ status: 200, data: { data: [] } })
  })

  renderWithProviders(<UserTable />)

  // Wait for the fetch to have been attempted and rejected.
  await waitFor(() => expect(fismaSystemsCalls()).toContain('/fismasystems'))
  // Give the microtask queue a beat to flush the rejection handler.
  await new Promise((r) => setTimeout(r, 20))
  // The catch fell through to console.error, not an uncaught rejection.
  expect(err).toHaveBeenCalled()
  err.mockRestore()
})

test('unmount during an in-flight fetch: the aborted-guard skips state updates and logging', async () => {
  // React runs the effect cleanup on unmount, which calls
  // controller.abort() and flips signal.aborted to true. The pending
  // axios request(s) then reject with cancel-like errors, and the
  // aborted-guard right after `await Promise.allSettled(...)`
  //   if (controller.signal.aborted) return
  // is the specific line that skips both setFismaSystemsMap and any
  // console.error branch. Regression: mutating or dropping that guard
  // would let the active-rejection error slip through and log a
  // spurious "Fetch active fisma systems error" every time the admin
  // navigates away from the users page mid-load.
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  let rejectFismaSystems!: (reason: Error) => void
  const pending = new Promise((_, reject) => {
    rejectFismaSystems = reject
  })
  // Capture the signal handed to axiosInstance.get so we can prove the
  // abort actually toggled it before we reject the promise.
  let capturedSignal: AbortSignal | undefined
  axios.get.mockImplementation(
    (url: string, opts: { signal?: AbortSignal }) => {
      if (url.startsWith('/users'))
        return Promise.resolve({ status: 200, data: { data: [] } })
      if (url === '/fismasystems') {
        capturedSignal = opts?.signal
        return pending
      }
      return Promise.resolve({ status: 200, data: { data: [] } })
    }
  )

  const { unmount } = renderWithProviders(<UserTable />)

  await waitFor(() => expect(fismaSystemsCalls()).toContain('/fismasystems'))
  expect(capturedSignal).toBeDefined()
  expect(capturedSignal?.aborted).toBe(false)

  unmount()
  // The effect cleanup ran, so the signal is now aborted BEFORE we reject
  // the pending promise. That means the catch block's guard is what
  // decides the outcome, not just React's setState-after-unmount inertia.
  expect(capturedSignal?.aborted).toBe(true)

  // Reject with a cancel-shaped error (axios uses CanceledError; the
  // catch doesn't inspect the shape, only the signal).
  const cancelErr = Object.assign(new Error('canceled'), {
    code: 'ERR_CANCELED',
  })
  rejectFismaSystems(cancelErr)
  await new Promise((r) => setTimeout(r, 20))

  // Guard suppressed the log. If someone deletes the guard line, this
  // becomes >=1 (the `console.error('Fetch active fisma systems error:'...)`
  // downstream of the guard fires) and the test flips red.
  const relevantLogs = errorSpy.mock.calls.filter((c) =>
    c.some(
      (arg) =>
        typeof arg === 'string' &&
        arg.includes('Fetch active fisma systems error')
    )
  )
  expect(relevantLogs).toHaveLength(0)
  errorSpy.mockRestore()
})

test('malformed response (data: null) does not crash the map build', async () => {
  axios.get.mockImplementation((url: string) => {
    if (url.startsWith('/users'))
      return Promise.resolve({ status: 200, data: { data: [] } })
    if (url === '/fismasystems')
      return Promise.resolve({ status: 200, data: { data: null } })
    return Promise.resolve({ status: 200, data: { data: [] } })
  })

  renderWithProviders(<UserTable />)

  await waitFor(() => expect(fismaSystemsCalls()).toContain('/fismasystems'))
  // No throw = pass. If the for-of loop had iterated over null, jest would
  // have failed the test with a "not iterable" TypeError.
  await new Promise((r) => setTimeout(r, 20))
})

// ---------------------------------------------------------------------------
// The global /fismasystems reads (active + decommissioned) are
// label sources fetched once on mount and held for the table's lifetime, not
// re-issued when the Assign Systems modal opens. The picker's selectable
// options come from a per-user /users/:id/assignablefismasystems read inside
// the modal instead. So opening the modal must NOT add global reads - this
// locks in the fetch-once-and-reuse contract that replaced the old
// refetch-on-open behavior.
// ---------------------------------------------------------------------------

test('opening the Assign Systems modal reuses the cached global reads (no refetch)', async () => {
  const user = userEvent.setup()
  const piett: users = {
    userid: '22222222-2222-2222-2222-222222222222',
    email: 'Admiral.Piett@executor.empire',
    fullname: 'Admiral Piett',
    role: 'ISSO',
    assignedfismasystems: [1002],
    assignedopdivids: [],
  }
  axios.get.mockImplementation((url: string) => {
    if (url === '/users' || url.startsWith('/users?'))
      return Promise.resolve({ status: 200, data: { data: [piett] } })
    if (url === '/fismasystems')
      return Promise.resolve({ status: 200, data: { data: ACTIVE_SYSTEMS } })
    // Per-user reads the modal issues on open; not global /fismasystems calls.
    if (url.includes('/assignablefismasystems'))
      return Promise.resolve({ status: 200, data: { data: ACTIVE_SYSTEMS } })
    if (url.includes('/assignedfismasystems'))
      return Promise.resolve({ status: 200, data: { data: [] } })
    return Promise.resolve({ status: 200, data: { data: [] } })
  })

  renderWithProviders(<UserTable />)

  // Initial mount fires both global endpoints once (active + decommissioned).
  await waitFor(() => expect(fismaSystemsCalls()).toHaveLength(2))
  // GridActionsCellItem is stubbed to a plain button whose aria-label is
  // the action's label prop ("assignedSystems" in UserTable's columns).
  const assignBtn = await screen.findByRole('button', {
    name: 'assignedSystems',
  })

  // Opening the modal fetches the per-user assigned/assignable lists, but must
  // reuse the cached global reads rather than re-issuing them.
  await user.click(assignBtn)
  await new Promise((r) => setTimeout(r, 20))
  expect(fismaSystemsCalls()).toHaveLength(2)
})

// ---------------------------------------------------------------------------
// User mutation flows: delete (with the self-delete guard) and restore. These
// churned under the delegates and OpDiv-scoping work and lost coverage when the
// original suite was deleted. Create/edit run through the MUI
// DataGrid inline-edit lifecycle (processRowUpdate), which the minimal grid
// mock here does not drive - covered separately.
// ---------------------------------------------------------------------------

// A manageable (assignable-tier) user other than the acting OWNER.
const PIETT_ROW: users = {
  userid: '22222222-2222-2222-2222-222222222222',
  email: 'Admiral.Piett@executor.empire',
  fullname: 'Admiral Piett',
  role: 'ISSO',
  assignedfismasystems: [],
  assignedopdivids: [],
}

function mockUsers(list: users[]) {
  axios.get.mockImplementation((url: string) => {
    if (url.startsWith('/users'))
      return Promise.resolve({ status: 200, data: { data: list } })
    if (url.startsWith('/fismasystems'))
      return Promise.resolve({ status: 200, data: { data: [] } })
    return Promise.resolve({ status: 200, data: { data: [] } })
  })
}

test('deleting a user confirms, DELETEs, drops the row, and notifies success', async () => {
  const user = userEvent.setup()
  mockUsers([PIETT_ROW])
  axios.delete.mockResolvedValue({ status: 200 })

  renderWithProviders(<UserTable />)

  const deleteBtn = await screen.findByRole('button', { name: 'Delete' })
  expect(deleteBtn).toBeEnabled()
  await user.click(deleteBtn)

  // Confirm dialog names the target and warns about lost access. Its confirm
  // button is labeled "Delete" (same as the row action), so scope to the dialog.
  const dialog = await screen.findByRole('dialog')
  expect(
    within(dialog).getByText(/Are you sure you want to delete Admiral Piett/)
  ).toBeInTheDocument()
  await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

  await waitFor(() =>
    expect(axios.delete).toHaveBeenCalledWith(
      '/users/22222222-2222-2222-2222-222222222222'
    )
  )
  expect(notify).toHaveBeenCalledWith(
    expect.stringContaining('Delete User Admiral Piett'),
    'success',
    expect.anything()
  )
})

test('cancelling the delete confirmation issues no DELETE', async () => {
  const user = userEvent.setup()
  mockUsers([PIETT_ROW])

  renderWithProviders(<UserTable />)

  await user.click(await screen.findByRole('button', { name: 'Delete' }))
  await user.click(screen.getByRole('button', { name: /cancel/i }))

  expect(axios.delete).not.toHaveBeenCalled()
})

test('the delete action is disabled for the acting user (self-delete guard)', async () => {
  // userInfo.userid is u-1 (the OWNER in makeCtx); a row for that same id must
  // render its Delete affordance disabled so an admin cannot lock themselves out.
  const selfRow: users = {
    userid: 'u-1',
    email: 'grand.moff@deathstar.empire',
    fullname: 'Grand Moff Tarkin',
    role: 'OWNER',
    assignedfismasystems: [],
    assignedopdivids: [],
  }
  mockUsers([selfRow])

  renderWithProviders(<UserTable />)

  const deleteBtn = await screen.findByRole('button', { name: 'Delete' })
  expect(deleteBtn).toBeDisabled()
})

test('a failed DELETE surfaces the try-again error and keeps the row', async () => {
  const user = userEvent.setup()
  mockUsers([PIETT_ROW])
  axios.delete.mockRejectedValue(new Error('backend 500'))

  renderWithProviders(<UserTable />)

  await user.click(await screen.findByRole('button', { name: 'Delete' }))
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

  await waitFor(() => expect(axios.delete).toHaveBeenCalled())
  expect(notify).toHaveBeenCalledWith(
    expect.stringMatching(/try again/i),
    'error',
    expect.anything()
  )
  // The row is not removed on failure. The mock grid renders only the actions
  // column, so assert row survival via its row testid rather than cell text.
  expect(
    screen.getByTestId('datagrid-row-22222222-2222-2222-2222-222222222222')
  ).toBeInTheDocument()
})

test('restoring a deleted user confirms, PUTs /restore, and notifies success', async () => {
  const user = userEvent.setup()
  mockUsers([{ ...PIETT_ROW, deleted: true } as users])
  axios.put.mockResolvedValue({ status: 200 })

  renderWithProviders(<UserTable />)

  await user.click(await screen.findByRole('button', { name: 'Restore' }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByText(/Restore Admiral Piett/)).toBeInTheDocument()
  await user.click(within(dialog).getByRole('button', { name: 'Restore' }))

  await waitFor(() =>
    expect(axios.put).toHaveBeenCalledWith(
      '/users/22222222-2222-2222-2222-222222222222/restore'
    )
  )
  expect(notify).toHaveBeenCalledWith(
    expect.stringContaining('Restore User Admiral Piett'),
    'success',
    expect.anything()
  )
})

// ---------------------------------------------------------------------------
// Create/edit save path (processRowUpdate) and the toolbar. These run through
// the DataGrid inline-edit lifecycle in production; here the mock captures the
// handler so the create POST, edit PUT, and error routing are exercised
// directly, and renders the toolbar so Add User and the view toggles run.
// ---------------------------------------------------------------------------

import { act } from '@testing-library/react'

test('the toolbar adds an editable row and toggles the view switches', async () => {
  const user = userEvent.setup()
  mockUsers([PIETT_ROW])

  renderWithProviders(<UserTable />)

  // Add User seeds a blank row in edit mode, which renders Save/Cancel actions.
  await user.click(await screen.findByRole('button', { name: /Add User/i }))
  expect(
    await screen.findByRole('button', { name: 'Save' })
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()

  // The view toggles drive their setters (and a refetch for Show Deleted).
  await user.click(screen.getByRole('checkbox', { name: /Show Deleted/i }))
  await user.click(screen.getByRole('checkbox', { name: /No Activity Only/i }))
})

test('Save on an incomplete new row shows the required-fields error', async () => {
  const user = userEvent.setup()
  mockUsers([PIETT_ROW])

  renderWithProviders(<UserTable />)

  await user.click(await screen.findByRole('button', { name: /Add User/i }))
  // The new row is blank, so committing it fails validation rather than saving.
  await user.click(await screen.findByRole('button', { name: 'Save' }))
  expect(
    await screen.findByText(/Please fill required fields/i)
  ).toBeInTheDocument()
})

test('Cancel on a new row removes it', async () => {
  const user = userEvent.setup()
  mockUsers([PIETT_ROW])

  renderWithProviders(<UserTable />)

  await user.click(await screen.findByRole('button', { name: /Add User/i }))
  await user.click(await screen.findByRole('button', { name: 'Cancel' }))
  // The Save/Cancel pair is gone once the new row is discarded.
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'Save' })
    ).not.toBeInTheDocument()
  )
})

test('processRowUpdate creates a user (POST /users) for a new row', async () => {
  mockUsers([])
  let postBody: Record<string, unknown> | undefined
  axios.post.mockImplementation(
    (url: string, body: Record<string, unknown>) => {
      if (url === '/users') {
        postBody = body
        return Promise.resolve({ data: { data: { userid: 'srv-1' } } })
      }
      return Promise.resolve({ data: {} })
    }
  )

  renderWithProviders(<UserTable />)
  await screen.findByTestId('datagrid-mock')

  await act(async () => {
    await mockGrid.processRowUpdate?.({
      userid: 500,
      isNew: true,
      fullname: 'New Admin',
      email: 'new@agency.gov',
      role: 'ISSO',
    })
  })

  expect(postBody).toMatchObject({
    fullname: 'New Admin',
    email: 'new@agency.gov',
    role: 'ISSO',
  })
})

test('processRowUpdate edits a user (PUT /users/:id) for an existing row', async () => {
  mockUsers([PIETT_ROW])
  let putUrl: string | undefined
  let putBody: Record<string, unknown> | undefined
  axios.put.mockImplementation((url: string, body: Record<string, unknown>) => {
    putUrl = url
    putBody = body
    return Promise.resolve({ data: {} })
  })

  renderWithProviders(<UserTable />)
  await screen.findByTestId('datagrid-mock')

  await act(async () => {
    await mockGrid.processRowUpdate?.({
      userid: PIETT_ROW.userid,
      isNew: false,
      fullname: 'Admiral Firmus Piett',
      email: 'piett@executor.empire',
      role: 'ISSM',
    })
  })

  expect(putUrl).toBe(`/users/${PIETT_ROW.userid}`)
  expect(putBody).toMatchObject({
    fullname: 'Admiral Firmus Piett',
    role: 'ISSM',
  })
})

test('processRowUpdate surfaces a 400 field error on a failed create', async () => {
  mockUsers([])
  axios.post.mockImplementation((url: string) => {
    if (url === '/users') {
      return Promise.reject({
        isAxiosError: true,
        response: {
          status: 400,
          data: { data: { email: 'Email already exists' } },
        },
      })
    }
    return Promise.resolve({ data: {} })
  })

  renderWithProviders(<UserTable />)
  await screen.findByTestId('datagrid-mock')

  await act(async () => {
    await mockGrid.processRowUpdate?.({
      userid: 501,
      isNew: true,
      fullname: 'Dup',
      email: 'dup@agency.gov',
      role: 'ISSO',
    })
  })

  expect(await screen.findByText(/Email already exists/i)).toBeInTheDocument()
})

test('backfills OpDiv grants per user when the list omits them inline', async () => {
  // An older backend response without assignedopdivids on the row triggers the
  // per-user fetchUserOpDivs backfill rather than the inline read.
  const legacyRow = {
    userid: '33333333-3333-3333-3333-333333333333',
    email: 'legacy@agency.gov',
    fullname: 'Legacy Admin',
    role: 'ISSO',
    assignedfismasystems: [],
  } as unknown as users
  const { fetchUserOpDivs } = require('@/utils/userOpdivs') as {
    fetchUserOpDivs: jest.Mock
  }
  fetchUserOpDivs.mockResolvedValue([1])
  mockUsers([legacyRow])

  renderWithProviders(<UserTable />)
  await screen.findByTestId('datagrid-mock')

  // The row has no inline grants, so the component fetches them per user.
  await waitFor(() =>
    expect(fetchUserOpDivs).toHaveBeenCalledWith(legacyRow.userid)
  )
})

test('processRowUpdate grants OpDivs when a new row carries them', async () => {
  mockUsers([])
  axios.post.mockImplementation((url: string) => {
    if (url === '/users')
      return Promise.resolve({ data: { data: { userid: 'srv-9' } } })
    return Promise.resolve({ data: {} })
  })

  renderWithProviders(<UserTable />)
  await screen.findByTestId('datagrid-mock')

  await act(async () => {
    await mockGrid.processRowUpdate?.({
      userid: 600,
      isNew: true,
      fullname: 'Granted Admin',
      email: 'granted@agency.gov',
      role: 'OPDIV_ADMIN',
      opdivs: [1, 2],
    })
  })

  // The created user's id is granted the selected OpDivs.
  expect(setUserOpDivs).toHaveBeenCalledWith('srv-9', [1, 2])
})

test('editing an existing row and saving valid values leaves edit mode', async () => {
  const user = userEvent.setup()
  mockUsers([PIETT_ROW])

  renderWithProviders(<UserTable />)

  // Enter edit mode via the row Edit action, then Save. PIETT_ROW is complete,
  // so validation passes and the row returns to view mode without an error.
  await user.click(await screen.findByRole('button', { name: 'Edit' }))
  await user.click(await screen.findByRole('button', { name: 'Save' }))

  expect(
    screen.queryByText(/Please fill required fields/i)
  ).not.toBeInTheDocument()
})

test('processRowUpdate surfaces the error toast on a failed edit', async () => {
  mockUsers([PIETT_ROW])
  axios.put.mockRejectedValue({
    isAxiosError: true,
    response: {
      status: 400,
      data: { data: { email: 'Email already in use' } },
    },
  })

  renderWithProviders(<UserTable />)
  await screen.findByTestId('datagrid-mock')

  await act(async () => {
    await mockGrid.processRowUpdate?.({
      userid: PIETT_ROW.userid,
      isNew: false,
      fullname: 'Admiral Piett',
      email: 'dup@executor.empire',
      role: 'ISSO',
    })
  })

  expect(await screen.findByText(/Email already in use/i)).toBeInTheDocument()
})
