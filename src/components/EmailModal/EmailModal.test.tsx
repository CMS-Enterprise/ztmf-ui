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
  // CMS design-system controls do not expose accessible names the way
  // native form elements do, so query by the underlying `name` attribute
  // which is stable and what the FormData submit reads.
  const group = document.querySelector(
    'select[name="email_group"]'
  ) as HTMLSelectElement
  await userEvent.selectOptions(group, 'ALL')

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

test('success path fires the success snackbar and surfaces sent emails', async () => {
  mock
    .onPost('/massemails')
    .reply(200, { data: ['user1@example.com', 'user2@example.com'] })

  renderWithProviders(<EmailModal openModal={true} closeModal={jest.fn()} />)
  await fillAndSubmit()

  expect(
    await screen.findByText(/emails have successfully been sent/i)
  ).toBeInTheDocument()
  expect(mockedNavigate).not.toHaveBeenCalled()
})

test('401 redirects to sign-in with the expired-session message', async () => {
  mock.onPost('/massemails').reply(401)

  renderWithProviders(<EmailModal openModal={true} closeModal={jest.fn()} />)
  await fillAndSubmit()

  await waitFor(() => {
    expect(mockedNavigate).toHaveBeenCalledWith(Routes.SIGNIN, {
      replace: true,
      state: { message: ERROR_MESSAGES.expired },
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
