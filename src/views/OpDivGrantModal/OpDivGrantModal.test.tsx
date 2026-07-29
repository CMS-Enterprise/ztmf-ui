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

// A grant to a non-assignable OpDiv (99, absent from opdivOptions) still chips
// with a readable label from opdivLabelMap - never a blank chip.
test('labels a grant to a non-assignable OpDiv from the full label map', async () => {
  mock.onGet(`/users/${USER_ID}/assignedopdivs`).reply(200, { data: [99] })

  renderModal()

  // The chip renders the label map entry, not a blank chip or a raw id.
  expect(await screen.findByText('ZZZ - Parent Division')).toBeInTheDocument()
})

// A grant to an OpDiv missing from the label map falls back to "OpDiv #{id}"
// rather than an empty chip.
test('falls back to "OpDiv #{id}" for a grant missing from the label map', async () => {
  mock.onGet(`/users/${USER_ID}/assignedopdivs`).reply(200, { data: [77] })

  renderModal()

  expect(await screen.findByText('OpDiv #77')).toBeInTheDocument()
})

// A non-assignable grant (99) resolves as a chip but must NOT be offered in the
// dropdown - filterOptions narrows the selectable set to the assignable OpDivs
// so it can't be re-selected.
test('dropdown excludes a non-assignable grant even though it chips', async () => {
  mock.onGet(`/users/${USER_ID}/assignedopdivs`).reply(200, { data: [99] })

  renderModal()
  // The grant chips (so the fetch has resolved and options are settled).
  await screen.findByText('ZZZ - Parent Division')

  // Open the dropdown.
  await userEvent.click(screen.getByRole('combobox'))

  // Assignable OpDivs are offered...
  expect(await screen.findByRole('option', { name: /AAA/ })).toBeInTheDocument()
  // ...but the non-assignable grant is filtered out of the selectable options.
  expect(screen.queryByRole('option', { name: /ZZZ/ })).not.toBeInTheDocument()
})

// A scoped caller's save strips out-of-scope ids regardless, so a delete would
// be a silent no-op. The out-of-scope chip renders WITHOUT a delete affordance,
// while an in-scope chip keeps it.
test('scoped caller: an out-of-scope grant chip is not deletable', async () => {
  mock.onGet(`/users/${USER_ID}/assignedopdivs`).reply(200, { data: [1, 99] })

  renderModal({ enforceCallerScope: true })

  const inScope = (await screen.findByText('AAA - Division A')).closest(
    '.MuiChip-root'
  ) as HTMLElement
  const outOfScope = screen
    .getByText('ZZZ - Parent Division')
    .closest('.MuiChip-root') as HTMLElement

  expect(inScope.querySelector('.MuiChip-deleteIcon')).not.toBeNull()
  expect(outOfScope.querySelector('.MuiChip-deleteIcon')).toBeNull()
})

// An unscoped caller's removal really revokes, so their out-of-scope chip must
// keep the delete affordance.
test('unscoped caller: an out-of-scope grant chip stays deletable', async () => {
  mock.onGet(`/users/${USER_ID}/assignedopdivs`).reply(200, { data: [99] })

  renderModal({ enforceCallerScope: false })

  const outOfScope = (await screen.findByText('ZZZ - Parent Division')).closest(
    '.MuiChip-root'
  ) as HTMLElement

  expect(outOfScope.querySelector('.MuiChip-deleteIcon')).not.toBeNull()
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

test('autocomplete picker is disabled while the initial grant fetch is in flight', async () => {
  mock
    .onGet(`/users/${USER_ID}/assignedopdivs`)
    .reply(() => new Promise(() => {}))

  renderModal()

  expect(screen.getByRole('combobox')).toBeDisabled()
  expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
})

test('autocomplete picker is disabled when the initial grant fetch fails', async () => {
  mock.onGet(`/users/${USER_ID}/assignedopdivs`).reply(500)

  renderModal()

  // Snackbar proves .catch ran and setFetchFailed(true) has committed.
  await screen.findByText(ERROR_MESSAGES.tryAgain)
  expect(screen.getByRole('combobox')).toBeDisabled()
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
