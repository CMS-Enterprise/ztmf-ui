// jest.mock calls must precede all imports that reference the mocked modules.
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

import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import axiosInstance from '@/axiosConfig'
import router from '@/router/router'
import OpDivGrantModal from './OpDivGrantModal'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import { ERROR_MESSAGES } from '@/constants'
import { Routes } from '@/router/constants'
import type { OpDiv } from '@/types'

const mockedNavigate = (router as unknown as { navigate: jest.Mock }).navigate
const mock = new MockAdapter(axiosInstance)

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_ID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const CALLER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

// The full assignable universe: active, non-parent OpDivs, NOT narrowed to the
// caller. The modal narrows this against the caller's fresh grants itself. 99 is
// intentionally absent (parent/inactive) so it can only ever appear as a
// current grant, never as a selectable option.
const assignableOpDivs: OpDiv[] = [
  {
    opdiv_id: 1,
    code: 'AAA',
    name: 'Division A',
    is_parent: false,
    active: true,
    system_delegate_enabled: false,
  },
  {
    opdiv_id: 2,
    code: 'BBB',
    name: 'Division B',
    is_parent: false,
    active: true,
    system_delegate_enabled: false,
  },
]

// Full label source (incl. the non-assignable OpDiv 99, e.g. a parent/inactive
// division), so the modal can label a grant to it even though it is absent from
// assignableOpDivs. Id 77 is intentionally absent to exercise the "OpDiv #{id}"
// fallback.
const opdivLabelMap: Record<number, { code: string; name: string }> = {
  1: { code: 'AAA', name: 'Division A' },
  2: { code: 'BBB', name: 'Division B' },
  99: { code: 'ZZZ', name: 'Parent Division' },
}

// The acting caller's own current grants, served fresh by the modal's on-open
// fetch. Mutable so a test can change it between two opens (the staleness case).
let callerGrants: number[] = [1, 2]
// Status the caller-scope fetch returns; non-200 exercises the failure paths
// (500 = generic error guard, 401 = auth redirect).
let callerFetchStatus = 200

function renderModal(
  overrides: Partial<React.ComponentProps<typeof OpDivGrantModal>> = {}
) {
  return renderWithProviders(
    <OpDivGrantModal
      open={true}
      handleClose={jest.fn()}
      userid={USER_ID}
      userName="Test User"
      assignableOpDivs={assignableOpDivs}
      opdivLabelMap={opdivLabelMap}
      enforceCallerScope={true}
      callerUserId={CALLER_ID}
      onChanged={jest.fn()}
      {...overrides}
    />
  )
}

// Waits for the modal's on-open fetches to settle (Save enabled = not loading).
// Fetch-count-agnostic, so it survives the extra caller-scope fetch.
const waitForReady = () =>
  waitFor(() =>
    expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled()
  )

beforeEach(() => {
  mock.reset()
  mockedNavigate.mockReset()
  callerGrants = [1, 2]
  callerFetchStatus = 200
  // The caller-scope fetch is read at request time, so mutating callerGrants
  // (or callerFetchStatus) between opens changes what the next open sees.
  mock
    .onGet(`/users/${CALLER_ID}/assignedopdivs`)
    .reply(() =>
      callerFetchStatus === 200
        ? [200, { data: callerGrants }]
        : [callerFetchStatus, {}]
    )
})

// Scoped caller (OPDIV_ADMIN, enforceCallerScope=true): the save strips
// out-of-scope grants before the PUT so the backend scope gate never 403s.
test('scoped caller: PUT body excludes grants the target holds outside caller scope', async () => {
  // Target user holds [1, 2, 99]. OpDiv 99 is absent from opdivOptions
  // (out of caller scope), so only [1, 2] must reach the batch endpoint.
  mock
    .onGet(`/users/${USER_ID}/assignedopdivs`)
    .reply(200, { data: [1, 2, 99] })
  mock.onPut(`/users/${USER_ID}/opdivs`).reply(204)

  renderModal({ enforceCallerScope: true })
  await waitForReady()

  await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

  await waitFor(() => expect(mock.history.put).toHaveLength(1))
  const body = JSON.parse(mock.history.put[0].data)
  expect(body.opdiv_ids).toHaveLength(2)
  expect(body.opdiv_ids).toEqual(expect.arrayContaining([1, 2]))
  expect(body.opdiv_ids).not.toContain(99)
})

// Unscoped caller (OWNER/HHS_ADMIN, enforceCallerScope=false): the save must
// PRESERVE the target's non-assignable grants. Omitting 99 would read as a
// revocation to the backend and silently drop the grant.
test('unscoped caller: PUT body preserves grants outside the assignable set', async () => {
  mock
    .onGet(`/users/${USER_ID}/assignedopdivs`)
    .reply(200, { data: [1, 2, 99] })
  mock.onPut(`/users/${USER_ID}/opdivs`).reply(204)

  renderModal({ enforceCallerScope: false })
  await waitForReady()

  await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

  await waitFor(() => expect(mock.history.put).toHaveLength(1))
  const body = JSON.parse(mock.history.put[0].data)
  expect(body.opdiv_ids).toEqual(expect.arrayContaining([1, 2, 99]))
  expect(body.opdiv_ids).toHaveLength(3)
})

// Scoped caller whose OWN grant (99) is to an OpDiv since re-parented or
// deactivated: 99 is in callerGrantIds (the backend still sees IsAssignedOpDiv
// = true) but absent from opdivOptions (parent/inactive is filtered out). The
// save must PRESERVE 99 - filtering on the narrower assignable set would strip
// it from the PUT and the backend's toRemove gate (pure grant membership) would
// then silently revoke the target's grant. The save boundary is the caller's
// raw scope, not the dropdown's assignable set.
test('scoped caller: preserves a caller-held grant that is no longer assignable', async () => {
  mock.onGet(`/users/${USER_ID}/assignedopdivs`).reply(200, { data: [1, 99] })
  mock.onPut(`/users/${USER_ID}/opdivs`).reply(204)

  callerGrants = [1, 99]
  renderModal()
  await waitForReady()

  await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

  await waitFor(() => expect(mock.history.put).toHaveLength(1))
  const body = JSON.parse(mock.history.put[0].data)
  expect(body.opdiv_ids).toEqual(expect.arrayContaining([1, 99]))
  expect(body.opdiv_ids).toHaveLength(2)
})

// The staleness AC: an OPDIV_ADMIN whose OWN grants change mid-session gets the
// current scope on the NEXT open, no reload. First open the caller does not hold
// 99; between opens they gain it; the second open must preserve the target's
// grant to 99, not strip it (which the backend would then revoke). Fetching the
// caller's scope fresh on each open is what makes the second open see the newer
// set - a session-cached scope would still be missing 99.
test('scoped caller: a mid-session scope change is picked up on the next open', async () => {
  mock.onGet(`/users/${USER_ID}/assignedopdivs`).reply(200, { data: [1, 99] })
  mock.onPut(`/users/${USER_ID}/opdivs`).reply(204)

  const modal = (open: boolean) => (
    <OpDivGrantModal
      open={open}
      handleClose={jest.fn()}
      userid={USER_ID}
      userName="Test User"
      assignableOpDivs={assignableOpDivs}
      opdivLabelMap={opdivLabelMap}
      enforceCallerScope={true}
      callerUserId={CALLER_ID}
      onChanged={jest.fn()}
    />
  )

  // First open: caller does not hold 99 yet.
  callerGrants = [1]
  const { rerender } = renderWithProviders(modal(true))
  await waitForReady()

  // Close, the caller gains 99, then reopen.
  rerender(modal(false))
  callerGrants = [1, 99]
  rerender(modal(true))
  await waitForReady()

  await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
  await waitFor(() => expect(mock.history.put).toHaveLength(1))
  const body = JSON.parse(mock.history.put[0].data)
  // The second open used the fresher scope, so 99 survives.
  expect(body.opdiv_ids).toEqual(expect.arrayContaining([1, 99]))
  expect(body.opdiv_ids).toHaveLength(2)
})

// The data-integrity guard: if the caller-scope fetch fails, the modal must
// block the save. Filtering the target's grants against an empty fallback scope
// would strip - and the backend then revoke - grants the caller actually holds.
test('scoped caller: a caller-scope fetch failure disables the modal and blocks save', async () => {
  mock.onGet(`/users/${USER_ID}/assignedopdivs`).reply(200, { data: [1, 2] })
  callerFetchStatus = 500

  renderModal()

  await screen.findByText(ERROR_MESSAGES.tryAgain)
  expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  expect(screen.getByLabelText('Search OpDivs')).toBeDisabled()
  expect(mock.history.put).toHaveLength(0)
})

// A scoped caller whose own grants were all revoked mid-session has an empty
// (but successfully fetched) scope. Save must be blocked so it can't PUT an
// empty desired set - distinct from the fetch-failure guard: the picker is
// enabled (load succeeded), only Save is blocked.
test('scoped caller: an empty caller scope blocks save without a fetch error', async () => {
  mock.onGet(`/users/${USER_ID}/assignedopdivs`).reply(200, { data: [1, 2] })
  callerGrants = []

  renderModal()

  // Picker enabled proves the load finished (not a loading/fetchFailed state)...
  await waitFor(() =>
    expect(screen.getByLabelText('Search OpDivs')).toBeEnabled()
  )
  // ...but Save stays disabled because the caller has no scope to grant from.
  expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  expect(mock.history.put).toHaveLength(0)
})

// Both fetches failing surfaces exactly one error toast, not one per fetch.
test('surfaces a single error snackbar when both fetches fail', async () => {
  mock.onGet(`/users/${USER_ID}/assignedopdivs`).reply(500)
  callerFetchStatus = 500

  renderModal()

  await screen.findByText(ERROR_MESSAGES.tryAgain)
  expect(screen.getAllByText(ERROR_MESSAGES.tryAgain)).toHaveLength(1)
})

// A 401 on the caller-scope fetch (target ok) redirects to sign-in via the auth
// interceptor and suppresses the generic error toast, same as a 401 on the
// target fetch.
test('a 401 on the caller-scope fetch redirects to sign-in without a generic toast', async () => {
  mock.onGet(`/users/${USER_ID}/assignedopdivs`).reply(200, { data: [1, 2] })
  callerFetchStatus = 401

  renderModal()

  await waitFor(() => {
    expect(mockedNavigate).toHaveBeenCalledWith(Routes.SIGNIN, {
      replace: true,
      state: { message: ERROR_MESSAGES.expired, reason: 'EXPIRED' },
    })
  })
  expect(screen.queryByText(ERROR_MESSAGES.tryAgain)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
})

// Self-row: an admin opening the modal on their own row (userid === callerUserId)
// hits the same endpoint for both fetches, so it must fire a single request.
test('self-row: caller opening their own row fires a single grants fetch', async () => {
  renderModal({ userid: CALLER_ID })
  await waitForReady()

  const selfGets = mock.history.get.filter(
    (g) => g.url === `/users/${CALLER_ID}/assignedopdivs`
  )
  expect(selfGets).toHaveLength(1)
})

// A grant to a non-assignable OpDiv (99, absent from opdivOptions) still chips
// with a readable label from opdivLabelMap - never a blank chip.
test('labels a grant to a non-assignable OpDiv from the full label map', async () => {
  mock.onGet(`/users/${USER_ID}/assignedopdivs`).reply(200, { data: [99] })

  renderModal()

  // The row renders the label map entry (code badge + name), not a raw id.
  expect(await screen.findByText('ZZZ')).toBeInTheDocument()
  expect(screen.getByText('Parent Division')).toBeInTheDocument()
})

// A grant to an OpDiv missing from the label map falls back to "OpDiv #{id}"
// rather than an empty chip.
test('falls back to "OpDiv #{id}" for a grant missing from the label map', async () => {
  mock.onGet(`/users/${USER_ID}/assignedopdivs`).reply(200, { data: [77] })

  renderModal()

  expect(await screen.findByText('OpDiv #77')).toBeInTheDocument()
})

// The list is the union of assignable OpDivs and current grants: a
// non-assignable grant (99) renders because the target holds it, and once the
// row is unchecked locally it cannot be re-added by any other row - nothing
// non-assignable and un-granted is ever offered.
test('list offers assignable OpDivs plus current grants only', async () => {
  mock.onGet(`/users/${USER_ID}/assignedopdivs`).reply(200, { data: [99] })

  renderModal()
  // Wait for both fetches so the picker is enabled and the assignable set is
  // narrowed against the caller's fresh scope.
  await waitForReady()

  // Assignable OpDivs are offered as rows...
  expect(screen.getByText('Division A')).toBeInTheDocument()
  expect(screen.getByText('Division B')).toBeInTheDocument()
  // ...and nothing outside assignable + granted appears (id 77 has no grant).
  expect(screen.queryByText('OpDiv #77')).not.toBeInTheDocument()
})

// A grant outside the caller's own backend scope (99 here is held by the target
// via another admin, not by this caller) is stripped on save regardless, so a
// delete would be a silent no-op: it renders WITHOUT a delete affordance, while
// an in-scope chip keeps it.
test('scoped caller: a chip outside the caller scope is not deletable', async () => {
  mock.onGet(`/users/${USER_ID}/assignedopdivs`).reply(200, { data: [1, 99] })

  // Caller holds [1, 2]; 99 is held by the target via another admin.
  renderModal()
  await waitForReady()

  // Rows render as labelled checkboxes; a locked (out-of-scope) row disables
  // its checkbox so the grant cannot be toggled into a silent no-op.
  const inScope = await screen.findByRole('checkbox', {
    name: /division a/i,
  })
  const outOfScope = screen.getByRole('checkbox', {
    name: /parent division/i,
  })

  expect(inScope).toBeEnabled()
  expect(outOfScope).toBeDisabled()
})

// A caller-held grant that is merely non-assignable now (99 in callerGrantIds
// but absent from opdivOptions, e.g. re-parented/deactivated) stays deletable:
// removing it is a real, permitted revocation, unlike an out-of-scope grant.
test('scoped caller: a caller-held but non-assignable chip stays deletable', async () => {
  mock.onGet(`/users/${USER_ID}/assignedopdivs`).reply(200, { data: [1, 99] })

  callerGrants = [1, 99]
  renderModal()
  await waitForReady()

  const heldNonAssignable = await screen.findByRole('checkbox', {
    name: /parent division/i,
  })

  expect(heldNonAssignable).toBeEnabled()
})

// An unscoped caller's removal really revokes, so their out-of-scope chip must
// keep the delete affordance.
test('unscoped caller: an out-of-scope grant chip stays deletable', async () => {
  mock.onGet(`/users/${USER_ID}/assignedopdivs`).reply(200, { data: [99] })

  renderModal({ enforceCallerScope: false })

  const outOfScope = await screen.findByRole('checkbox', {
    name: /parent division/i,
  })

  expect(outOfScope).toBeEnabled()
})

test('success: modal closes and onChanged fires after save', async () => {
  mock.onGet(`/users/${USER_ID}/assignedopdivs`).reply(200, { data: [1] })
  mock.onPut(`/users/${USER_ID}/opdivs`).reply(204)

  const handleClose = jest.fn()
  const onChanged = jest.fn()
  renderModal({ handleClose, onChanged })

  await waitForReady()
  await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

  await waitFor(() => {
    expect(handleClose).toHaveBeenCalledTimes(1)
    expect(onChanged).toHaveBeenCalledWith(USER_ID)
  })
})

test('modal stays open on save error and does not call onChanged', async () => {
  mock.onGet(`/users/${USER_ID}/assignedopdivs`).reply(200, { data: [] })
  mock.onPut(`/users/${USER_ID}/opdivs`).reply(500)

  const handleClose = jest.fn()
  const onChanged = jest.fn()
  renderModal({ handleClose, onChanged })

  await waitForReady()
  await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

  expect(await screen.findByText(ERROR_MESSAGES.tryAgain)).toBeInTheDocument()
  expect(handleClose).not.toHaveBeenCalled()
  expect(onChanged).not.toHaveBeenCalled()
})

test('403 shows the permission snackbar and does not close the modal', async () => {
  mock.onGet(`/users/${USER_ID}/assignedopdivs`).reply(200, { data: [] })
  mock.onPut(`/users/${USER_ID}/opdivs`).reply(403)

  const handleClose = jest.fn()
  renderModal({ handleClose })

  await waitForReady()
  await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

  expect(await screen.findByText(ERROR_MESSAGES.permission)).toBeInTheDocument()
  expect(handleClose).not.toHaveBeenCalled()
})

test('401 redirects to sign-in without firing a generic error snackbar', async () => {
  mock.onGet(`/users/${USER_ID}/assignedopdivs`).reply(200, { data: [] })
  mock.onPut(`/users/${USER_ID}/opdivs`).reply(401)

  renderModal()
  await waitForReady()
  await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

  await waitFor(() => {
    expect(mockedNavigate).toHaveBeenCalledWith(Routes.SIGNIN, {
      replace: true,
      state: { message: ERROR_MESSAGES.expired, reason: 'EXPIRED' },
    })
  })
  expect(screen.queryByText(ERROR_MESSAGES.tryAgain)).not.toBeInTheDocument()
})

test('save button is disabled while the request is in flight', async () => {
  mock.onGet(`/users/${USER_ID}/assignedopdivs`).reply(200, { data: [] })
  // Never resolves — keeps the request in-flight so we can assert the disabled state.
  mock.onPut(`/users/${USER_ID}/opdivs`).reply(() => new Promise(() => {}))

  renderModal()
  const saveButton = screen.getByRole('button', { name: /^save$/i })

  await waitForReady()
  await userEvent.click(saveButton)

  expect(saveButton).toBeDisabled()
})

test('save button is disabled until the initial grant fetch resolves', async () => {
  // GET never resolves — keeps the modal in loading state indefinitely.
  mock
    .onGet(`/users/${USER_ID}/assignedopdivs`)
    .reply(() => new Promise(() => {}))

  renderModal()
  const saveButton = screen.getByRole('button', { name: /^save$/i })

  expect(saveButton).toBeDisabled()
})

test('save button stays disabled when the initial grant fetch fails', async () => {
  mock.onGet(`/users/${USER_ID}/assignedopdivs`).reply(500)

  renderModal()

  // Wait for the full error path to settle — snackbar proves .catch ran and
  // setFetchFailed(true) has committed, not just that the GET was sent.
  await screen.findByText(ERROR_MESSAGES.tryAgain)
  expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
})

test('list controls are disabled while the initial grant fetch is in flight', async () => {
  mock
    .onGet(`/users/${USER_ID}/assignedopdivs`)
    .reply(() => new Promise(() => {}))

  renderModal()

  // The redesign renders a search box + a loading notice instead of an
  // Autocomplete; both the search input and Save stay disabled mid-flight.
  expect(screen.getByLabelText('Search OpDivs')).toBeDisabled()
  expect(screen.getByText(/loading opdivs/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
})

test('list controls are disabled when the initial grant fetch fails', async () => {
  mock.onGet(`/users/${USER_ID}/assignedopdivs`).reply(500)

  renderModal()

  // Snackbar proves .catch ran and setFetchFailed(true) has committed.
  await screen.findByText(ERROR_MESSAGES.tryAgain)
  expect(screen.getByLabelText('Search OpDivs')).toBeDisabled()
  expect(
    screen.getByText(/could not load this user's opdivs/i)
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
})

test('closing after a fetch failure resets error state so Save re-enables on reopen', async () => {
  mock.onGet(`/users/${USER_ID}/assignedopdivs`).replyOnce(500)
  mock.onGet(`/users/${USER_ID}/assignedopdivs`).reply(200, { data: [] })

  const { rerender } = renderModal()

  await screen.findByText(ERROR_MESSAGES.tryAgain)
  expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()

  rerender(
    <OpDivGrantModal
      open={false}
      handleClose={jest.fn()}
      userid={USER_ID}
      userName="Test User"
      assignableOpDivs={assignableOpDivs}
      opdivLabelMap={opdivLabelMap}
      enforceCallerScope={true}
      callerUserId={CALLER_ID}
      onChanged={jest.fn()}
    />
  )
  rerender(
    <OpDivGrantModal
      open={true}
      handleClose={jest.fn()}
      userid={USER_ID}
      userName="Test User"
      assignableOpDivs={assignableOpDivs}
      opdivLabelMap={opdivLabelMap}
      enforceCallerScope={true}
      callerUserId={CALLER_ID}
      onChanged={jest.fn()}
    />
  )

  // Second GET resolves successfully — Save must re-enable.
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /^save$/i })).not.toBeDisabled()
  )
})

test('401 on the initial grant fetch redirects to sign-in without a generic error snackbar', async () => {
  mock.onGet(`/users/${USER_ID}/assignedopdivs`).reply(401)

  renderModal()

  await waitFor(() => {
    expect(mockedNavigate).toHaveBeenCalledWith(Routes.SIGNIN, {
      replace: true,
      state: { message: ERROR_MESSAGES.expired, reason: 'EXPIRED' },
    })
  })
  expect(screen.queryByText(ERROR_MESSAGES.tryAgain)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
})

test('stale fetch from a prior user is discarded when userid changes', async () => {
  // User A's fetch is intentionally slow — held until we manually release it.
  let resolveUserA!: () => void
  mock.onGet(`/users/${USER_ID}/assignedopdivs`).reply(
    () =>
      new Promise((res) => {
        resolveUserA = () => res([200, { data: [1] }])
      })
  )
  // User B's fetch resolves immediately with a different grant set.
  mock.onGet(`/users/${USER_ID_B}/assignedopdivs`).reply(200, { data: [2] })
  mock.onPut(`/users/${USER_ID_B}/opdivs`).reply(204)

  const onChanged = jest.fn()
  const { rerender } = renderModal()

  // Switch to user B before user A's fetch resolves — triggers effect cleanup.
  rerender(
    <OpDivGrantModal
      open={true}
      handleClose={jest.fn()}
      userid={USER_ID_B}
      userName="Test User B"
      assignableOpDivs={assignableOpDivs}
      opdivLabelMap={opdivLabelMap}
      enforceCallerScope={true}
      callerUserId={CALLER_ID}
      onChanged={onChanged}
    />
  )

  // User B's fetches have resolved (Save enabled); user A's is still pending.
  await waitForReady()

  // Release user A's stale fetch — the cancelled flag should swallow the result.
  resolveUserA()

  // Save must send user B's grant (opdiv 2), not user A's stale grant (opdiv 1).
  await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
  await waitFor(() => expect(mock.history.put).toHaveLength(1))
  const body = JSON.parse(mock.history.put[0].data)
  expect(body.opdiv_ids).toEqual([2])
  expect(body.opdiv_ids).not.toContain(1)
  expect(onChanged).toHaveBeenCalledWith(USER_ID_B)
  expect(onChanged).not.toHaveBeenCalledWith(USER_ID)
})
