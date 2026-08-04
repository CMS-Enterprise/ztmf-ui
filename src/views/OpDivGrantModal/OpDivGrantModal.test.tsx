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

// Represents the caller's grantable scope (children, active, and — for an
// OPDIV_ADMIN — limited to their own OpDivs). OpDiv 99 is intentionally absent
// so scope-filter tests can verify it is stripped from the PUT body.
const opdivOptions: OpDiv[] = [
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
// opdivOptions. Id 77 is intentionally absent to exercise the "OpDiv #{id}"
// fallback.
const opdivLabelMap: Record<number, { code: string; name: string }> = {
  1: { code: 'AAA', name: 'Division A' },
  2: { code: 'BBB', name: 'Division B' },
  99: { code: 'ZZZ', name: 'Parent Division' },
}

function renderModal(
  overrides: Partial<React.ComponentProps<typeof OpDivGrantModal>> = {}
) {
  return renderWithProviders(
    <OpDivGrantModal
      open={true}
      handleClose={jest.fn()}
      userid={USER_ID}
      userName="Test User"
      opdivOptions={opdivOptions}
      opdivLabelMap={opdivLabelMap}
      enforceCallerScope={true}
      callerGrantIds={[1, 2]}
      onChanged={jest.fn()}
      {...overrides}
    />
  )
}

beforeEach(() => {
  mock.reset()
  mockedNavigate.mockReset()
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
  await waitFor(() => expect(mock.history.get).toHaveLength(1))

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
  await waitFor(() => expect(mock.history.get).toHaveLength(1))

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

  renderModal({ enforceCallerScope: true, callerGrantIds: [1, 99] })
  await waitFor(() => expect(mock.history.get).toHaveLength(1))

  await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

  await waitFor(() => expect(mock.history.put).toHaveLength(1))
  const body = JSON.parse(mock.history.put[0].data)
  expect(body.opdiv_ids).toEqual(expect.arrayContaining([1, 99]))
  expect(body.opdiv_ids).toHaveLength(2)
})

// A grant to a non-assignable OpDiv (99, absent from opdivOptions) still
// renders a row with a readable label from opdivLabelMap - never a blank row.
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
  // The grant renders (so the fetch has resolved and rows are settled).
  await screen.findByText('Parent Division')

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

  renderModal({ enforceCallerScope: true, callerGrantIds: [1, 2] })

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

  renderModal({ enforceCallerScope: true, callerGrantIds: [1, 99] })

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

  await waitFor(() => expect(mock.history.get).toHaveLength(1))
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

  await waitFor(() => expect(mock.history.get).toHaveLength(1))
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

  await waitFor(() => expect(mock.history.get).toHaveLength(1))
  await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

  expect(await screen.findByText(ERROR_MESSAGES.permission)).toBeInTheDocument()
  expect(handleClose).not.toHaveBeenCalled()
})

test('401 redirects to sign-in without firing a generic error snackbar', async () => {
  mock.onGet(`/users/${USER_ID}/assignedopdivs`).reply(200, { data: [] })
  mock.onPut(`/users/${USER_ID}/opdivs`).reply(401)

  renderModal()
  await waitFor(() => expect(mock.history.get).toHaveLength(1))
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

  await waitFor(() => expect(mock.history.get).toHaveLength(1))
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
      opdivOptions={opdivOptions}
      opdivLabelMap={opdivLabelMap}
      enforceCallerScope={true}
      callerGrantIds={[1, 2]}
      onChanged={jest.fn()}
    />
  )
  rerender(
    <OpDivGrantModal
      open={true}
      handleClose={jest.fn()}
      userid={USER_ID}
      userName="Test User"
      opdivOptions={opdivOptions}
      opdivLabelMap={opdivLabelMap}
      enforceCallerScope={true}
      callerGrantIds={[1, 2]}
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
      opdivOptions={opdivOptions}
      opdivLabelMap={opdivLabelMap}
      enforceCallerScope={true}
      callerGrantIds={[1, 2]}
      onChanged={onChanged}
    />
  )

  // Both GETs have been sent; user B's has already resolved.
  await waitFor(() => expect(mock.history.get).toHaveLength(2))

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
