import MockAdapter from 'axios-mock-adapter'

// Replace the app's axios instance with a bare one so the real interceptor's
// router graph stays out of this suite.
jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: '/api/v1/' }) }
})

jest.mock('@/utils/notify', () => {
  const actual = jest.requireActual('@/utils/notify')
  return { ...actual, notify: jest.fn() }
})

import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axiosInstance from '@/axiosConfig'
import { renderWithQueryClient } from '@/test-utils/renderWithQueryClient'
import { notify } from '@/utils/notify'
import DataCallModal from './DataCallModal'

const mock = new MockAdapter(axiosInstance)

const NAME = 'FY2027 ZTM'
const DEADLINE = '2027-09-30'

beforeEach(() => {
  jest.clearAllMocks()
  mock.reset()
})

/** Fills both fields with a valid data call so Create becomes enabled. */
async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^name/i), NAME)
  const deadline = screen.getByLabelText(/^deadline/i)
  await user.clear(deadline)
  await user.type(deadline, DEADLINE)
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /^create$/i })).toBeEnabled()
  )
}

test('creates the data call, notifies, fires onCreated, and closes', async () => {
  const user = userEvent.setup()
  mock.onPost('/datacalls').reply(201)
  const onCreated = jest.fn()
  const onClose = jest.fn()
  renderWithQueryClient(
    <DataCallModal open onClose={onClose} onCreated={onCreated} />
  )

  await fillValidForm(user)
  await user.click(screen.getByRole('button', { name: /^create$/i }))

  await waitFor(() => expect(mock.history.post).toHaveLength(1))
  expect(JSON.parse(mock.history.post[0].data)).toEqual({
    datacall: NAME,
    deadline: new Date(DEADLINE).toISOString(),
  })
  // The callback is still what refreshes the caller's list; the mutation's
  // invalidation reaches nothing until that read becomes a query.
  await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1))
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('a duplicate name toasts the backend message and leaves the modal open', async () => {
  const user = userEvent.setup()
  // The real shape for this endpoint. A duplicate maps to model.ErrNotUnique,
  // which the controller returns as a 400 carrying the text in `error` with no
  // field map, so parseApiError yields a message and no fieldErrors.
  mock
    .onPost('/datacalls')
    .reply(400, { error: 'not unique : (FY2027 Q4) already exists.' })
  const onClose = jest.fn()
  renderWithQueryClient(
    <DataCallModal open onClose={onClose} onCreated={jest.fn()} />
  )

  await fillValidForm(user)
  await user.click(screen.getByRole('button', { name: /^create$/i }))

  await waitFor(() =>
    expect(notify).toHaveBeenCalledWith(
      'not unique : (FY2027 Q4) already exists.',
      'error',
      expect.anything()
    )
  )
  expect(onClose).not.toHaveBeenCalled()
  // Nothing lands under the Name field, because the response carries no map
  // to route. The inline branch below covers the shape that would.
  expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument()
})

test('a 400 field map lands under the Name field instead of a toast', async () => {
  const user = userEvent.setup()
  // No datacall error currently returns this shape, so this pins the branch
  // rather than the endpoint. Keep it: validation that does return a map is
  // the reason the branch exists.
  mock
    .onPost('/datacalls')
    .reply(400, { data: { datacall: 'a data call with this name exists' } })
  const onClose = jest.fn()
  renderWithQueryClient(
    <DataCallModal open onClose={onClose} onCreated={jest.fn()} />
  )

  await fillValidForm(user)
  await user.click(screen.getByRole('button', { name: /^create$/i }))

  expect(
    await screen.findByText(/a data call with this name exists/i)
  ).toBeInTheDocument()
  expect(notify).not.toHaveBeenCalled()
  expect(onClose).not.toHaveBeenCalled()
})

test('a create started before the modal closes still lands and still reports', async () => {
  const user = userEvent.setup()
  let release!: () => void
  mock.onPost('/datacalls').reply(
    () =>
      new Promise((resolve) => {
        release = () => resolve([201, {}])
      })
  )
  const onCreated = jest.fn()
  const { rerender } = renderWithQueryClient(
    <DataCallModal open onClose={jest.fn()} onCreated={onCreated} />
  )

  await fillValidForm(user)
  await user.click(screen.getByRole('button', { name: /^create$/i }))
  await waitFor(() => expect(mock.history.post).toHaveLength(1))

  // Closing is not a cancel. The write is already on its way to the server and
  // aborting here would not un-commit it, so the request runs to completion and
  // the caller still learns the outcome.
  rerender(
    <DataCallModal open={false} onClose={jest.fn()} onCreated={onCreated} />
  )
  release()

  await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1))
  expect(notify).toHaveBeenCalledWith(
    'Datacall has successfully been created',
    'success',
    expect.anything()
  )
})

test('reopening after a close mid-create shows a clean, enabled form', async () => {
  const user = userEvent.setup()
  // Never resolves, so the create is still in flight when the modal closes.
  mock.onPost('/datacalls').reply(() => new Promise(() => {}))
  const { rerender } = renderWithQueryClient(
    <DataCallModal open onClose={jest.fn()} onCreated={jest.fn()} />
  )

  await fillValidForm(user)
  await user.click(screen.getByRole('button', { name: /^create$/i }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled()
  )

  // Close and reopen while that request is still outstanding. The modal stays
  // mounted, so without a reset the mutation's pending state would carry over
  // and strand the next open behind a disabled "Creating..." button.
  rerender(
    <DataCallModal open={false} onClose={jest.fn()} onCreated={jest.fn()} />
  )
  rerender(<DataCallModal open onClose={jest.fn()} onCreated={jest.fn()} />)

  expect(
    screen.queryByRole('button', { name: /creating/i })
  ).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^create$/i })).toBeInTheDocument()
  expect(screen.getByLabelText(/^name/i)).toHaveValue('')
})
