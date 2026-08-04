// Coverage for the Assign Systems modal. Globals (allSystems +
// decommSystems) are fetched by the parent UserTable and passed down as
// props, so the modal itself only fires the two per-user reads on open:
//   - GET /users/:id/assignedfismasystems (current assignments)
//   - GET /users/:id/assignablefismasystems (server-scoped picker options)
// The modal renders a checkbox list: assignable systems plus any current
// assignments outside that set (cross-scope orphans, decommissioned
// systems), which stay visible - labeled and subdued - so an admin can
// still unassign them. Tests verify:
//   - both per-user reads fire on open,
//   - the list offers exactly what the assignable endpoint returns,
//   - decommissioned entries render with a "(Decommissioned)" suffix and
//     subdued styling,
//   - cross-scope orphan assignments render labeled from the passed-in
//     global list so an admin can still unassign them,
//   - a failing assignable read degrades gracefully,
//   - reopening for a different user clears the previous rows, but
//     reopening for the same user keeps them visible while the fresh
//     reads run underneath,
//   - assign / unassign round-trip to the right endpoints, with unassign
//     gated behind the confirm dialog, and
//   - an id absent from every metadata source still renders identifiably.

jest.mock('@/router/router', () => ({
  __esModule: true,
  default: { navigate: jest.fn() },
}))

jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  const { handleAuthError } = require('@/utils/authInterceptor')
  const instance = axios.create({ baseURL: '/api/v1/' })
  instance.interceptors.response.use(
    (response: unknown) => response,
    handleAuthError
  )
  return { __esModule: true, default: instance }
})

import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import axiosInstance from '@/axiosConfig'
import AssignSystemModal from './AssignSystemModal'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import type { FismaSystemType } from '@/types'

const mock = new MockAdapter(axiosInstance)

const USER_ID = '22222222-2222-2222-2222-222222222222'

// Minimal FismaSystemType-shaped rows. Only the fields the modal reads
// (fismasystemid, fismaacronym, fismaname, fismasubsystem) are meaningful.
const DS1: FismaSystemType = {
  fismasystemid: 1001,
  fismaacronym: 'DS-1',
  fismaname: 'Death Star',
  fismasubsystem: null,
} as unknown as FismaSystemType

const CHI: FismaSystemType = {
  fismasystemid: 1101,
  fismaacronym: 'ISD-CHI',
  fismaname: 'Star Destroyer Chimaera',
  fismasubsystem: null,
} as unknown as FismaSystemType

const EXECUTOR: FismaSystemType = {
  fismasystemid: 1002,
  fismaacronym: 'SSD-EX',
  fismaname: 'Super Star Destroyer Executor',
  fismasubsystem: 'Flagship Communication Hub',
} as unknown as FismaSystemType

function renderModal(
  overrides: Partial<React.ComponentProps<typeof AssignSystemModal>> = {}
) {
  return renderWithProviders(
    <AssignSystemModal
      open={true}
      handleClose={() => {}}
      userid={USER_ID}
      userName="Admiral Piett"
      allSystems={[]}
      decommSystems={[]}
      {...overrides}
    />
  )
}

/** All system-row checkboxes currently rendered (excludes dialog buttons). */
const rowCheckboxes = (): HTMLInputElement[] =>
  Array.from(
    document.body.querySelectorAll('input[id^="assign-system-"]')
  ) as HTMLInputElement[]

/** The row checkbox whose label matches the pattern. */
const rowCheckbox = (pattern: RegExp): HTMLInputElement =>
  screen.getByRole('checkbox', { name: pattern }) as HTMLInputElement

/** Scopes queries to the unassign ConfirmDialog. */
const unassignDialog = async () => {
  const title = await screen.findByText('Confirm Unassign System')
  return within(title.closest('[role="dialog"]') as HTMLElement)
}

beforeEach(() => {
  mock.reset()
})

test('fires the two per-user reads on open', async () => {
  mock.onGet(`/users/${USER_ID}/assignedfismasystems`).reply(200, { data: [] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [] })

  renderModal()

  await waitFor(() =>
    expect(
      mock.history.get.some((r) =>
        (r.url ?? '').endsWith(`/users/${USER_ID}/assignedfismasystems`)
      )
    ).toBe(true)
  )
  expect(
    mock.history.get.some((r) =>
      (r.url ?? '').endsWith(`/users/${USER_ID}/assignablefismasystems`)
    )
  ).toBe(true)
  // Globals come from props now - modal must NOT fire them.
  expect(
    mock.history.get.some((r) => (r.url ?? '').endsWith('/fismasystems'))
  ).toBe(false)
  expect(
    mock.history.get.some((r) =>
      (r.url ?? '').endsWith('/fismasystems?decommissioned=true')
    )
  ).toBe(false)
})

test('assigned system flagged decommissioned via props renders with "(Decommissioned)" suffix and subdued styling', async () => {
  const retiredExecutor: FismaSystemType = {
    ...EXECUTOR,
    decommissioned: true,
  } as unknown as FismaSystemType
  mock
    .onGet(`/users/${USER_ID}/assignedfismasystems`)
    .reply(200, { data: [1002] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [DS1] })

  renderModal({
    allSystems: [DS1],
    decommSystems: [retiredExecutor],
  })

  const label = await screen.findByText(
    /Super Star Destroyer Executor\s*-\s*Flagship Communication Hub\s*\(Decommissioned\)/i
  )
  const row = label.closest('label') as HTMLElement
  const rowStyle = window.getComputedStyle(row)
  expect(parseFloat(rowStyle.opacity)).toBeLessThan(1)
  expect(rowStyle.fontStyle).toBe('italic')
})

test('list offers exactly the systems the assignable endpoint returns', async () => {
  mock.onGet(`/users/${USER_ID}/assignedfismasystems`).reply(200, { data: [] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [DS1, CHI] })

  renderModal()

  expect(await screen.findByText('Death Star')).toBeInTheDocument()
  expect(screen.getByText('Star Destroyer Chimaera')).toBeInTheDocument()
  expect(rowCheckboxes()).toHaveLength(2)
})

test('typing an acronym filters the list to the matching system', async () => {
  // The picker must match on the acronym, not just the system name: typing
  // "ISD" surfaces ISD-CHI and drops DS-1 / Death Star.
  const user = userEvent.setup()
  mock.onGet(`/users/${USER_ID}/assignedfismasystems`).reply(200, { data: [] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [DS1, CHI] })

  renderModal()
  await screen.findByText('Death Star')

  await user.type(
    screen.getByRole('textbox', { name: /search fisma systems/i }),
    'ISD'
  )

  expect(screen.getByText('Star Destroyer Chimaera')).toBeInTheDocument()
  expect(screen.queryByText('Death Star')).not.toBeInTheDocument()
})

test('acronym matching is case-insensitive', async () => {
  const user = userEvent.setup()
  mock.onGet(`/users/${USER_ID}/assignedfismasystems`).reply(200, { data: [] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [DS1, CHI] })

  renderModal()
  await screen.findByText('Death Star')

  await user.type(
    screen.getByRole('textbox', { name: /search fisma systems/i }),
    'isd'
  )

  expect(screen.getByText('Star Destroyer Chimaera')).toBeInTheDocument()
  expect(screen.queryByText('Death Star')).not.toBeInTheDocument()
})

test('typing a system name filters the list to the matching system', async () => {
  const user = userEvent.setup()
  mock.onGet(`/users/${USER_ID}/assignedfismasystems`).reply(200, { data: [] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [DS1, CHI] })

  renderModal()
  await screen.findByText('Star Destroyer Chimaera')

  await user.type(
    screen.getByRole('textbox', { name: /search fisma systems/i }),
    'Death'
  )

  expect(screen.getByText('Death Star')).toBeInTheDocument()
  expect(screen.queryByText('Star Destroyer Chimaera')).not.toBeInTheDocument()
})

test('assignable subsystem name is appended to the label', async () => {
  mock.onGet(`/users/${USER_ID}/assignedfismasystems`).reply(200, { data: [] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [EXECUTOR] })

  renderModal()

  expect(
    await screen.findByText(
      /Super Star Destroyer Executor\s*-\s*Flagship Communication Hub/i
    )
  ).toBeInTheDocument()
})

test('an out-of-scope orphan assignment renders labeled from the allSystems prop', async () => {
  // Piett is currently assigned to Executor (1002). The server excludes
  // Executor from his per-user assignable set (its OpDiv is no longer in
  // his scope), but the parent-supplied allSystems prop still carries it
  // as an active system. The row must render labeled - the admin needs to
  // see WHICH system they are unassigning - checked, and once unchecked it
  // cannot be re-picked (it leaves the list entirely).
  mock
    .onGet(`/users/${USER_ID}/assignedfismasystems`)
    .reply(200, { data: [1002] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [DS1] })

  renderModal({ allSystems: [DS1, EXECUTOR] })

  const orphan = await screen.findByText(/Super Star Destroyer Executor/i)
  expect(orphan).toBeInTheDocument()
  const orphanCheckbox = rowCheckbox(/super star destroyer executor/i)
  expect(orphanCheckbox.checked).toBe(true)
  // The assignable system renders as a normal pickable row alongside it.
  expect(rowCheckbox(/death star/i).checked).toBe(false)
})

test('empty assignable response offers no pickable rows; existing assignments still render', async () => {
  mock
    .onGet(`/users/${USER_ID}/assignedfismasystems`)
    .reply(200, { data: [1001] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [] })

  renderModal({ allSystems: [DS1] })

  // The existing assignment renders (checked); nothing else is offered.
  const assigned = await screen.findByText('Death Star')
  expect(assigned).toBeInTheDocument()
  await waitFor(() => expect(rowCheckboxes()).toHaveLength(1))
  expect(rowCheckboxes()[0].checked).toBe(true)
})

test('an assignable-endpoint failure degrades gracefully to the assigned rows', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mock
    .onGet(`/users/${USER_ID}/assignedfismasystems`)
    .reply(200, { data: [1001] })
  mock.onGet(`/users/${USER_ID}/assignablefismasystems`).reply(500)

  renderModal({ allSystems: [DS1] })

  // The assignment is still visible and removable even with no options.
  expect(await screen.findByText('Death Star')).toBeInTheDocument()
  await waitFor(() => expect(rowCheckboxes()).toHaveLength(1))
  ;(console.error as jest.Mock).mockRestore?.()
})

test('assigned system present in the assignable set renders a labeled checked row', async () => {
  mock
    .onGet(`/users/${USER_ID}/assignedfismasystems`)
    .reply(200, { data: [1002] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [EXECUTOR] })

  renderModal()

  expect(
    await screen.findByText(/Super Star Destroyer Executor/i)
  ).toBeInTheDocument()
  expect(rowCheckbox(/super star destroyer executor/i).checked).toBe(true)
})

test('an id absent from every metadata source still renders identifiably', async () => {
  // Defense in depth for the blank-row failure mode. The parent's global
  // reads are allSettled, so a failure there leaves an out-of-scope orphan
  // with no label source at all. The row must still say something an admin
  // can act on - a blank row gives no way to tell what is being unassigned.
  mock
    .onGet(`/users/${USER_ID}/assignedfismasystems`)
    .reply(200, { data: [9999] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [DS1] })

  renderModal({ allSystems: [], decommSystems: [] })

  expect(
    await screen.findByText(/Unknown or decommissioned system \(id 9999\)/)
  ).toBeInTheDocument()
})

test('an already-assigned system shows as checked alongside pickable rows', async () => {
  // Guards against double-assigning: the assigned row is already checked
  // (re-checking is impossible), while an unassigned option in the same
  // list stays selectable.
  mock
    .onGet(`/users/${USER_ID}/assignedfismasystems`)
    .reply(200, { data: [1001] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [DS1, CHI] })

  renderModal()
  await screen.findByText('Death Star')

  const assignedCheckbox = rowCheckbox(/death star/i)
  expect(assignedCheckbox.checked).toBe(true)

  const freeCheckbox = rowCheckbox(/star destroyer chimaera/i)
  expect(freeCheckbox.checked).toBe(false)
  expect(freeCheckbox.disabled).toBe(false)
})

test('checking a row POSTs the assignment and marks it checked', async () => {
  const user = userEvent.setup()
  mock.onGet(`/users/${USER_ID}/assignedfismasystems`).reply(200, { data: [] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [DS1] })
  mock.onPost(`/users/${USER_ID}/assignedfismasystems`).reply(200, {})

  renderModal()
  await screen.findByText('Death Star')

  await user.click(rowCheckbox(/death star/i))

  await waitFor(() => expect(mock.history.post.length).toBe(1))
  expect(JSON.parse(mock.history.post[0].data)).toEqual({
    fismasystemid: 1001,
  })
  await waitFor(() => expect(rowCheckbox(/death star/i).checked).toBe(true))
})

test('a failed assign POST leaves the row unchecked rather than showing a false success', async () => {
  // The optimistic value is only committed after the POST resolves, so a
  // rejected write must not leave a checked row implying the grant landed.
  const user = userEvent.setup()
  mock.onGet(`/users/${USER_ID}/assignedfismasystems`).reply(200, { data: [] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [DS1] })
  mock.onPost(`/users/${USER_ID}/assignedfismasystems`).reply(500)

  renderModal()
  await screen.findByText('Death Star')

  await user.click(rowCheckbox(/death star/i))

  await waitFor(() => expect(mock.history.post.length).toBe(1))
  expect(rowCheckbox(/death star/i).checked).toBe(false)
})

test('unchecking a row asks for confirmation and DELETEs only on confirm', async () => {
  const user = userEvent.setup()
  mock
    .onGet(`/users/${USER_ID}/assignedfismasystems`)
    .reply(200, { data: [1001] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [DS1] })
  mock.onDelete(`/users/${USER_ID}/assignedfismasystems/1001`).reply(200, {})

  renderModal()
  await screen.findByText('Death Star')
  await waitFor(() => expect(rowCheckbox(/death star/i).checked).toBe(true))

  await user.click(rowCheckbox(/death star/i))

  // Confirm dialog names the system and the user so the admin can see
  // exactly what they are about to revoke.
  const dialog = await unassignDialog()
  expect(
    dialog.getByText(/unassign DS-1\s*-\s*Death Star from Admiral Piett/i)
  ).toBeInTheDocument()
  // Nothing is written until the admin confirms.
  expect(mock.history.delete.length).toBe(0)

  await user.click(dialog.getByRole('button', { name: /^confirm$/i }))

  await waitFor(() => expect(mock.history.delete.length).toBe(1))
  await waitFor(() => expect(rowCheckbox(/death star/i).checked).toBe(false))
})

test('cancelling the unassign prompt keeps the row checked and writes nothing', async () => {
  const user = userEvent.setup()
  mock
    .onGet(`/users/${USER_ID}/assignedfismasystems`)
    .reply(200, { data: [1001] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [DS1] })
  mock.onDelete(`/users/${USER_ID}/assignedfismasystems/1001`).reply(200, {})

  renderModal()
  await screen.findByText('Death Star')
  await waitFor(() => expect(rowCheckbox(/death star/i).checked).toBe(true))

  await user.click(rowCheckbox(/death star/i))
  const dialog = await unassignDialog()
  await user.click(dialog.getByRole('button', { name: /^cancel$/i }))

  expect(mock.history.delete.length).toBe(0)
  // The dialog fades out and un-hides the modal beneath it; wait for the
  // row to be queryable again before asserting its state.
  await waitFor(() => expect(rowCheckbox(/death star/i).checked).toBe(true))
})

test('a decommissioned assignment is still removable', async () => {
  // The subdued styling marks it as historical, but an admin must still be
  // able to revoke it - that is the whole point of keeping the row
  // rendered rather than dropping unknown-to-assignable ids.
  const user = userEvent.setup()
  const retiredExecutor: FismaSystemType = {
    ...EXECUTOR,
    decommissioned: true,
  } as unknown as FismaSystemType
  mock
    .onGet(`/users/${USER_ID}/assignedfismasystems`)
    .reply(200, { data: [1002] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [DS1] })
  mock.onDelete(`/users/${USER_ID}/assignedfismasystems/1002`).reply(200, {})

  renderModal({ allSystems: [DS1], decommSystems: [retiredExecutor] })
  await screen.findByText(/\(Decommissioned\)/)

  const checkbox = rowCheckbox(/super star destroyer executor/i)
  expect(checkbox.disabled).toBe(false)
  await user.click(checkbox)

  const dialog = await unassignDialog()
  expect(dialog.getByText(/unassign SSD-EX/i)).toBeInTheDocument()
  await user.click(dialog.getByRole('button', { name: /^confirm$/i }))

  await waitFor(() => expect(mock.history.delete.length).toBe(1))
})

test('a failing assigned read still leaves the picker usable', async () => {
  // Inverse of the assignable-failure case: the assignment source is gone
  // but the picker options survive, so the admin can still grant access.
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mock.onGet(`/users/${USER_ID}/assignedfismasystems`).reply(500)
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [DS1, CHI] })

  renderModal()

  expect(await screen.findByText('Death Star')).toBeInTheDocument()
  expect(screen.getByText('Star Destroyer Chimaera')).toBeInTheDocument()
  expect(rowCheckboxes().every((cb) => !cb.checked)).toBe(true)
  ;(console.error as jest.Mock).mockRestore?.()
})

test('rows are ordered by acronym regardless of response order', async () => {
  mock.onGet(`/users/${USER_ID}/assignedfismasystems`).reply(200, { data: [] })
  // Deliberately reverse-sorted on the wire.
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [EXECUTOR, CHI, DS1] })

  renderModal()
  await screen.findByText('Death Star')

  // DS-1 (1001) < ISD-CHI (1101) < SSD-EX (1002)
  const ids = rowCheckboxes().map((cb) => cb.id)
  expect(ids).toEqual([
    'assign-system-1001',
    'assign-system-1101',
    'assign-system-1002',
  ])
})

test('reopening for a different user clears the previous rows before new fetches resolve', async () => {
  // User A resolves with an assignment; user B's fetches are held so we
  // can observe the intermediate state. The stateOwnerRef check clears
  // rows when the userid changes - otherwise user A's assignment would
  // linger until user B's response arrived.
  const OTHER_USER_ID = '33333333-3333-3333-3333-333333333333'
  mock
    .onGet(`/users/${USER_ID}/assignedfismasystems`)
    .reply(200, { data: [1002] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [EXECUTOR] })
  let releaseB: () => void = () => {}
  const bPending = new Promise<void>((resolve) => {
    releaseB = resolve
  })
  mock
    .onGet(`/users/${OTHER_USER_ID}/assignedfismasystems`)
    .reply(() => bPending.then(() => [200, { data: [] }]))
  mock
    .onGet(`/users/${OTHER_USER_ID}/assignablefismasystems`)
    .reply(() => bPending.then(() => [200, { data: [] }]))

  const utils = renderModal()

  await waitFor(() => expect(rowCheckboxes()).toHaveLength(1))

  utils.rerender(
    <AssignSystemModal
      open={true}
      handleClose={() => {}}
      userid={OTHER_USER_ID}
      userName="Some Other User"
      allSystems={[]}
      decommSystems={[]}
    />
  )
  await waitFor(() => expect(rowCheckboxes()).toHaveLength(0))

  releaseB()
})

test('reopening for the SAME user keeps rows visible while fresh fetches run', async () => {
  // Same-user reopen: the modal must NOT blank the list while the refresh
  // reads are in flight. Contrast with the different-user test above -
  // that path clears; this path preserves. Perceived latency matters most
  // here: an admin who opens the picker, closes it, and reopens should see
  // the assignments instantly.
  mock
    .onGet(`/users/${USER_ID}/assignedfismasystems`)
    .reply(200, { data: [1002] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [EXECUTOR] })

  const utils = renderModal()

  await waitFor(() => expect(rowCheckboxes()).toHaveLength(1))
  // Flush the second state setter (setAssignable) from the initial
  // Promise.allSettled so the rerender below doesn't race a lingering
  // update outside act(). The waitFor above only confirms one of the two.
  await act(async () => {
    await Promise.resolve()
  })

  // Close and hold the reopen fetches so we can observe the moment
  // just after `open` flips true again.
  let releaseReopen: () => void = () => {}
  const reopenPending = new Promise<void>((resolve) => {
    releaseReopen = resolve
  })
  mock.reset()
  mock
    .onGet(`/users/${USER_ID}/assignedfismasystems`)
    .reply(() => reopenPending.then(() => [200, { data: [1002] }]))
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(() => reopenPending.then(() => [200, { data: [EXECUTOR] }]))

  await act(async () => {
    utils.rerender(
      <AssignSystemModal
        open={false}
        handleClose={() => {}}
        userid={USER_ID}
        userName="Admiral Piett"
        allSystems={[]}
        decommSystems={[]}
      />
    )
    utils.rerender(
      <AssignSystemModal
        open={true}
        handleClose={() => {}}
        userid={USER_ID}
        userName="Admiral Piett"
        allSystems={[]}
        decommSystems={[]}
      />
    )
  })

  // Rows stay visible during the in-flight refresh - no empty flash.
  expect(rowCheckboxes()).toHaveLength(1)
  expect(rowCheckboxes()[0].checked).toBe(true)
  releaseReopen()
})
