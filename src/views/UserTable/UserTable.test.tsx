// Regression coverage for the Assign Systems picker's option pool. The
// map is built inside UserTable from dedicated /fismasystems fetches
// rather than context.fismaSystems, which the dashboard's Show
// Decommissioned toggle would otherwise swap to the decommissioned-only
// response. See AssignSystemModal.test.tsx for the paired picker-
// rendering assertions.

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
    // GridActionsCellItem uses useGridRootProps and only works inside a
    // real DataGrid. Replace it with a plain button so it renders under
    // our mocked DataGrid below.
    GridActionsCellItem: (props: {
      icon?: React.ReactNode
      label?: string
      onClick?: () => void
    }) =>
      react.createElement(
        'button',
        {
          type: 'button',
          'aria-label': props.label,
          onClick: props.onClick,
        },
        props.label
      ),
    // Minimal DataGrid that renders each row's action column so row-level
    // buttons are clickable in tests.
    DataGrid: (props: {
      rows?: Array<Record<string, unknown>>
      columns?: Array<Record<string, unknown>>
      getRowId?: (row: Record<string, unknown>) => string | number
    }) => {
      const { rows = [], columns = [], getRowId } = props
      return react.createElement(
        'div',
        { 'data-testid': 'datagrid-mock' },
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
              return null
            })
          )
        })
      )
    },
  }
})

jest.mock('@/utils/config', () => ({
  __esModule: true,
  default: { IDP_ENABLED: false },
}))

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

import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UserTable, { buildFismaSystemsMap } from './UserTable'
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

// -----------------------------------------------------------------------
// End-to-end chain: fetch response -> buildFismaSystemsMap -> picker map.
// The UserTable render tests above prove the fetch fires; the modal render
// tests prove the picker surfaces whatever map it receives. This unit test
// closes the middle link by asserting the mapper produces the exact shape
// the picker consumes, using the same ACTIVE_SYSTEMS fixture the fetch
// tests hand to axios.
// -----------------------------------------------------------------------

test('buildFismaSystemsMap turns the /fismasystems response into picker-ready entries', () => {
  const map = buildFismaSystemsMap(ACTIVE_SYSTEMS)
  expect(map).toEqual({
    1001: { acronym: 'DS-1', name: 'Death Star', decommissioned: false },
    1101: {
      acronym: 'ISD-CHI',
      name: 'Star Destroyer Chimaera',
      decommissioned: false,
    },
  })
})

test('buildFismaSystemsMap tags decommissioned entries with decommissioned: true', () => {
  // Callers pass the union of active and decommissioned systems; the
  // mapper carries the flag through so the modal can render a
  // "(Decommissioned)" suffix + subdued styling and filter these entries
  // out of the selectable dropdown.
  const mixed: FismaSystemType[] = [
    ...ACTIVE_SYSTEMS,
    {
      fismasystemid: 9001,
      fismaacronym: 'DECOM-A',
      fismaname: 'Decommissioned System A',
      fismasubsystem: null,
      decommissioned: true,
    } as unknown as FismaSystemType,
  ]
  const map = buildFismaSystemsMap(mixed)
  expect(map[1001].decommissioned).toBe(false)
  expect(map[9001]).toEqual({
    acronym: 'DECOM-A',
    name: 'Decommissioned System A',
    decommissioned: true,
  })
})

test('buildFismaSystemsMap appends the subsystem name when present', () => {
  const map = buildFismaSystemsMap([
    {
      fismasystemid: 1002,
      fismaacronym: 'SSD-EX',
      fismaname: 'Super Star Destroyer Executor',
      fismasubsystem: 'Flagship Communication Hub',
    } as unknown as FismaSystemType,
  ])
  expect(map[1002]).toEqual({
    acronym: 'SSD-EX',
    name: 'Super Star Destroyer Executor - Flagship Communication Hub',
    decommissioned: false,
  })
})

test('buildFismaSystemsMap returns an empty map for null/undefined/empty input', () => {
  expect(buildFismaSystemsMap(null)).toEqual({})
  expect(buildFismaSystemsMap(undefined)).toEqual({})
  expect(buildFismaSystemsMap([])).toEqual({})
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
// #574: opening the Assign Systems modal refetches so any system added
// elsewhere in the session shows up in the picker without the admin having
// to navigate away from /users and back. handleOpenModal invokes
// loadActiveSystems directly (no state-as-signal), so this test also
// implicitly locks in "no spurious refetch on unrelated interactions" by
// counting requests - only clicking the row action bumps the count.
// ---------------------------------------------------------------------------

test('clicking the Assign Systems row action refetches /fismasystems', async () => {
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
    if (url.startsWith('/users'))
      return Promise.resolve({ status: 200, data: { data: [piett] } })
    if (url === '/fismasystems')
      return Promise.resolve({ status: 200, data: { data: ACTIVE_SYSTEMS } })
    return Promise.resolve({ status: 200, data: { data: [] } })
  })

  renderWithProviders(<UserTable />)

  // Initial mount fires both endpoints once (active + decommissioned).
  await waitFor(() => expect(fismaSystemsCalls()).toHaveLength(2))
  // GridActionsCellItem is stubbed to a plain button whose aria-label is
  // the action's label prop ("assignedSystems" in UserTable's columns).
  const assignBtn = await screen.findByRole('button', {
    name: 'assignedSystems',
  })

  // Clicking the icon opens the modal AND invokes loadFismaSystems
  // directly from the event handler, issuing both requests again.
  await user.click(assignBtn)
  await waitFor(() => expect(fismaSystemsCalls()).toHaveLength(4))
})
