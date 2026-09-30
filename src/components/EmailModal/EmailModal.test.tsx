import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import { ERROR_MESSAGES } from '@/constants'
import { Routes } from '@/router/constants'

// Mock the router module so we can spy on the imperative navigate the
// interceptor calls. The actual router instance touches the production
// hash router which is not what we want under jsdom.
jest.mock('@/router/router', () => ({
  __esModule: true,
  default: { navigate: jest.fn() },
}))

// Replace @/axiosConfig with a fresh axios instance that has the same
// interceptor registered. The production module accesses import.meta.env
// at top level and swc/jest leaves that literal in the CommonJS output,
// which throws "Cannot use 'import.meta' outside a module" on load.
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

import axiosInstance from '@/axiosConfig'
import router from '@/router/router'
import EmailModal from './EmailModal'
import { renderWithProviders } from '@/test-utils/renderWithProviders'

const mockedNavigate = (router as unknown as { navigate: jest.Mock }).navigate
const mock = new MockAdapter(axiosInstance)

async function fillAndSubmit() {
  // The Send To control is a MUI Select rendered as an aria combobox button
  // (no real <select> element). Open it, then click the "ALL" option.
  const group = screen.getByRole('combobox', { name: /send to/i })
  await userEvent.click(group)
  const option = await screen.findByRole('option', { name: 'ALL' })
  await userEvent.click(option)

  const subject = document.querySelector(
    'input[name="email_subject"]'
  ) as HTMLInputElement
  await userEvent.type(subject, 'hello')

  const body = document.querySelector(
    'textarea[name="email_body"]'
  ) as HTMLTextAreaElement
  await userEvent.type(body, 'world')

  await userEvent.click(screen.getByRole('button', { name: /^send$/i }))
}

beforeEach(() => {
  mock.reset()
  mockedNavigate.mockReset()
})

test('states the minimum length and blocks Send until both fields meet it', async () => {
  renderWithProviders(<EmailModal openModal={true} closeModal={jest.fn()} />)

  // An untouched form explains the field rather than opening covered in red.
  expect(
    screen.getByText(/appears as the subject line of the email/i)
  ).toBeInTheDocument()
  expect(screen.queryByText(/needs at least 4 characters/i)).toBeNull()

  const group = screen.getByRole('combobox', { name: /send to/i })
  await userEvent.click(group)
  await userEvent.click(await screen.findByRole('option', { name: 'ALL' }))

  const subject = document.querySelector(
    'input[name="email_subject"]'
  ) as HTMLInputElement
  const body = document.querySelector(
    'textarea[name="email_body"]'
  ) as HTMLTextAreaElement
  const send = screen.getByRole('button', { name: /^send$/i })

  // Two characters in the subject is the exact case that produced a bare
  // "an error occurred" from the backend. Now it says so in place.
  await userEvent.type(subject, 'sg')
  await userEvent.type(body, 'long enough')
  expect(send).toBeDisabled()
  expect(
    await screen.findByText(/needs at least 4 characters/i)
  ).toBeInTheDocument()

  // Whitespace does not count toward the minimum.
  await userEvent.clear(subject)
  await userEvent.type(subject, '    ')
  expect(send).toBeDisabled()

  await userEvent.clear(subject)
  await userEvent.type(subject, 'four')
  expect(send).toBeEnabled()
  expect(screen.queryByText(/needs at least 4 characters/i)).toBeNull()

  expect(mock.history.post).toHaveLength(0)
})

test('success path fires the success snackbar and surfaces sent emails', async () => {
  mock
    .onPost('/massemails')
    .reply(200, { data: ['user1@example.com', 'user2@example.com'] })

  renderWithProviders(<EmailModal openModal={true} closeModal={jest.fn()} />)
  await fillAndSubmit()

  // Reports the recipient count rather than claiming delivery. The API answers
  // before the send is attempted, so "sent" is more than it can know.
  expect(
    await screen.findByText(/sending to 2 recipients/i)
  ).toBeInTheDocument()
  expect(mockedNavigate).not.toHaveBeenCalled()
})

test('a group with nobody contactable warns instead of reporting success', async () => {
  // Reachable in production: the backend short-circuits when every user in the
  // group is missing an address, which got likelier after the HHS import.
  mock.onPost('/massemails').reply(200, { data: [] })

  renderWithProviders(<EmailModal openModal={true} closeModal={jest.fn()} />)
  await fillAndSubmit()

  expect(
    await screen.findByText(/no one in ALL has an email address on file/i)
  ).toBeInTheDocument()
  expect(screen.queryByText(/sending to/i)).toBeNull()
})

test('offers System Delegate as a targetable email group and posts its key', async () => {
  // The backend (ztmf#458) accepts a SYSTEM_DELEGATE group key on
  // /massemails, so the delegate cohort must be selectable here. Assert both
  // the option exists and the raw key (not the friendly label) is submitted.
  let posted: Record<string, unknown> = {}
  mock.onPost('/massemails').reply((config) => {
    posted = JSON.parse(config.data as string)
    return [200, { data: ['delegate@example.com'] }]
  })

  renderWithProviders(<EmailModal openModal={true} closeModal={jest.fn()} />)

  // The Send To control is a MUI Select (aria combobox), so the option
  // renders in a listbox with the friendly label while the modal posts the
  // raw role key.
  const group = screen.getByRole('combobox', { name: /send to/i })
  await userEvent.click(group)
  const option = await screen.findByRole('option', {
    name: 'System Delegate',
  })
  await userEvent.click(option)

  await userEvent.type(
    document.querySelector('input[name="email_subject"]') as HTMLInputElement,
    'hello'
  )
  await userEvent.type(
    document.querySelector(
      'textarea[name="email_body"]'
    ) as HTMLTextAreaElement,
    'world'
  )
  await userEvent.click(screen.getByRole('button', { name: /^send$/i }))

  await waitFor(() => {
    expect(posted.group).toBe('SYSTEM_DELEGATE')
  })
})

test('offers READONLY_ADMIN as a targetable email group and posts its key', async () => {
  // The backend accepts a READONLY_ADMIN group key on /massemails
  // (ztmf-misc#297), covering the HHS_READONLY_ADMIN and OPDIV_READONLY_ADMIN
  // tiers. Pin the option so the read-only cohort stays reachable.
  let posted: Record<string, unknown> = {}
  mock.onPost('/massemails').reply((config) => {
    posted = JSON.parse(config.data as string)
    return [200, { data: ['readonly@example.com'] }]
  })

  renderWithProviders(<EmailModal openModal={true} closeModal={jest.fn()} />)

  // The Send To control is a MUI Select (aria combobox), not a native select,
  // so open the listbox and click the option.
  const group = screen.getByRole('combobox', { name: /send to/i })
  await userEvent.click(group)
  const option = await screen.findByRole('option', { name: 'READONLY_ADMIN' })
  await userEvent.click(option)

  await userEvent.type(
    document.querySelector('input[name="email_subject"]') as HTMLInputElement,
    'hello'
  )
  await userEvent.type(
    document.querySelector(
      'textarea[name="email_body"]'
    ) as HTMLTextAreaElement,
    'world'
  )
  await userEvent.click(screen.getByRole('button', { name: /^send$/i }))

  await waitFor(() => {
    expect(posted.group).toBe('READONLY_ADMIN')
  })
})

test('401 redirects to sign-in with the expired-session message and reason', async () => {
  mock.onPost('/massemails').reply(401)

  renderWithProviders(<EmailModal openModal={true} closeModal={jest.fn()} />)
  await fillAndSubmit()

  await waitFor(() => {
    expect(mockedNavigate).toHaveBeenCalledWith(Routes.SIGNIN, {
      replace: true,
      state: { message: ERROR_MESSAGES.expired, reason: 'EXPIRED' },
    })
  })
  // No generic fallback snackbar fires on top of the redirect.
  expect(screen.queryByText(ERROR_MESSAGES.tryAgain)).not.toBeInTheDocument()
})

test('403 fires the permission snackbar with no redirect', async () => {
  mock.onPost('/massemails').reply(403)

  renderWithProviders(<EmailModal openModal={true} closeModal={jest.fn()} />)
  await fillAndSubmit()

  expect(await screen.findByText(ERROR_MESSAGES.permission)).toBeInTheDocument()
  expect(mockedNavigate).not.toHaveBeenCalled()
})

test('500 falls through the interceptor and fires the tryAgain snackbar', async () => {
  mock.onPost('/massemails').reply(500)

  renderWithProviders(<EmailModal openModal={true} closeModal={jest.fn()} />)
  await fillAndSubmit()

  expect(await screen.findByText(ERROR_MESSAGES.tryAgain)).toBeInTheDocument()
  expect(mockedNavigate).not.toHaveBeenCalled()
})
