import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignInReasons } from '@/utils/authCodes'
import { Routes } from '@/router/constants'

// Hoist-safe mocks: react-router-dom is mocked module-wide so we can drive
// useLocation / useRouteLoaderData / Navigate per-test without spinning up
// a data router.
jest.mock('react-router-dom', () => ({
  __esModule: true,
  useLocation: jest.fn(),
  useRouteLoaderData: jest.fn(),
  Navigate: ({ to }: { to: string }) => <div>NAVIGATE:{to}</div>,
}))

// CONFIG.IDP_ENABLED is read at module load by LoginPage; the mock
// returns a mutable object so beforeEach can flip the flag per-test.
// Inline declaration avoids the "Cannot access before initialization"
// hoist trap with const declared above jest.mock.
jest.mock('@/utils/config', () => ({
  __esModule: true,
  default: { IDP_ENABLED: false },
}))

// authLookup makes a network call we do not want firing from a unit test.
jest.mock('@/utils/authLookup', () => ({
  __esModule: true,
  lookupIdpForEmail: jest.fn(),
}))

// The project's fileTransform.cjs still returns the old (pre-Jest 28) raw
// string contract, so a real PNG import errors out during transform. Stub
// the asset so LoginPage can load. (Fixing the transformer is out of
// scope for this PR.)
jest.mock('@/assets/ztmf-logo-login.png', () => 'ztmf-logo-login.png', {
  virtual: true,
})

import { useLocation, useRouteLoaderData } from 'react-router-dom'
import CONFIG from '@/utils/config'
import { lookupIdpForEmail } from '@/utils/authLookup'
import LoginPage from './LoginPage'

const mockedUseLocation = useLocation as jest.Mock
const mockedUseRouteLoaderData = useRouteLoaderData as jest.Mock
const mockedLookup = lookupIdpForEmail as jest.Mock
const mutableConfig = CONFIG as unknown as { IDP_ENABLED: boolean }

beforeEach(() => {
  mockedUseLocation.mockReset()
  mockedUseRouteLoaderData.mockReset()
  mutableConfig.IDP_ENABLED = false
})

describe('LoginPage active-session redirect', () => {
  it('redirects to the dashboard when the loader reports an active session', () => {
    mockedUseLocation.mockReturnValue({ pathname: '/signin', state: null })
    mockedUseRouteLoaderData.mockReturnValue({ status: 200, response: {} })

    render(<LoginPage />)

    expect(screen.getByText(`NAVIGATE:${Routes.ROOT}`)).toBeInTheDocument()
  })
})

describe('LoginPage NO_ACCOUNT terminal state', () => {
  it('renders the backend message and no Sign in button when reason comes from location.state', () => {
    mockedUseLocation.mockReturnValue({
      pathname: '/signin',
      state: {
        reason: SignInReasons.NO_ACCOUNT,
        message:
          'your ZTMF account is no longer active; contact your administrator',
      },
    })
    mockedUseRouteLoaderData.mockReturnValue(undefined)

    render(<LoginPage />)

    expect(
      screen.getByText(/no longer active; contact your administrator/i)
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sign in/i })).toBeNull()
    expect(screen.queryByLabelText(/enter your email/i)).toBeNull()
  })

  it('reads the reason from the root loader when location.state is empty', () => {
    mockedUseLocation.mockReturnValue({ pathname: '/', state: null })
    mockedUseRouteLoaderData.mockReturnValue({
      ok: false,
      reason: SignInReasons.NO_ACCOUNT,
      message:
        'your authenticated identity does not have a ZTMF account; contact your administrator to request access',
      response: {},
    })

    render(<LoginPage />)

    expect(
      screen.getByText(/does not have a ZTMF account/i)
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sign in/i })).toBeNull()
  })

  it('falls back to the canned terminal copy when no message is provided', () => {
    mockedUseLocation.mockReturnValue({
      pathname: '/signin',
      state: { reason: SignInReasons.NO_ACCOUNT },
    })
    mockedUseRouteLoaderData.mockReturnValue(undefined)

    render(<LoginPage />)

    expect(
      screen.getByText(/Your ZTMF account is not set up/i)
    ).toBeInTheDocument()
  })
})

describe('LoginPage EXPIRED / default state', () => {
  it('renders the Sign in button on the legacy Okta variant', () => {
    mockedUseLocation.mockReturnValue({
      pathname: '/signin',
      state: {
        reason: SignInReasons.EXPIRED,
        message: 'Your session has expired. Please log in again.',
      },
    })
    mockedUseRouteLoaderData.mockReturnValue(undefined)

    render(<LoginPage />)

    expect(screen.getByText(/your session has expired/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument()
  })

  it('renders the email-lookup form on the IDP_ENABLED variant', () => {
    mutableConfig.IDP_ENABLED = true
    mockedUseLocation.mockReturnValue({ pathname: '/signin', state: null })
    mockedUseRouteLoaderData.mockReturnValue(undefined)

    render(<LoginPage />)

    expect(screen.getByLabelText(/enter your email/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /continue/i })
    ).toBeInTheDocument()
  })

  it('renders the IDP_ENABLED form when reason is unset (cold load)', () => {
    mutableConfig.IDP_ENABLED = true
    mockedUseLocation.mockReturnValue({ pathname: '/', state: null })
    mockedUseRouteLoaderData.mockReturnValue({
      ok: false,
      reason: SignInReasons.EXPIRED,
      response: {},
    })

    render(<LoginPage />)

    expect(screen.getByLabelText(/enter your email/i)).toBeInTheDocument()
  })

  it('shows no session-expired copy on cold-load EXPIRED (loader path)', () => {
    // A loader-path 401 is ambiguous (expired session vs first visit),
    // so LoginPage stays quiet here. Real expiry copy comes from the
    // interceptor path.
    mutableConfig.IDP_ENABLED = true
    mockedUseLocation.mockReturnValue({ pathname: '/', state: null })
    mockedUseRouteLoaderData.mockReturnValue({
      ok: false,
      reason: SignInReasons.EXPIRED,
      response: {},
    })

    render(<LoginPage />)

    expect(screen.getByLabelText(/enter your email/i)).toBeInTheDocument()
    expect(
      screen.queryByText(/your session has expired/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/your session is missing/i)
    ).not.toBeInTheDocument()
  })
})

describe('IdpLookupLogin submit: routing and error mapping', () => {
  const originalLocation = window.location

  beforeEach(() => {
    // Outer beforeEach sets IDP_ENABLED false and resets the router mocks;
    // drive the email-lookup variant with a signed-out session here.
    mutableConfig.IDP_ENABLED = true
    mockedUseLocation.mockReturnValue({ pathname: '/signin', state: null })
    mockedUseRouteLoaderData.mockReturnValue(undefined)
    mockedLookup.mockReset()
    // jsdom rejects an href assignment on the real window.location; swap in
    // a writable stub so the redirect target is observable and no real
    // navigation is attempted.
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { href: '' },
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    })
  })

  async function submitEmail(email: string) {
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.type(screen.getByLabelText(/enter your email/i), email)
    await user.click(screen.getByRole('button', { name: /continue/i }))
  }

  it('redirects to /login when the lookup resolves to okta', async () => {
    mockedLookup.mockResolvedValue({ idp: 'okta' })
    await submitEmail('user@okta.example')
    await waitFor(() => expect(window.location.href).toBe('/login'))
  })

  it('redirects to /login/entra when the lookup resolves to entra', async () => {
    mockedLookup.mockResolvedValue({ idp: 'entra' })
    await submitEmail('user@entra.example')
    await waitFor(() => expect(window.location.href).toBe('/login/entra'))
  })

  it('shows the generic message and does not navigate on a null result', async () => {
    mockedLookup.mockResolvedValue({ idp: null })
    await submitEmail('nobody@example.com')
    expect(
      await screen.findByText(/can't determine an identity provider/i)
    ).toBeInTheDocument()
    expect(window.location.href).toBe('')
  })

  it('shows the retry message (and not the generic message) and does not navigate when unavailable', async () => {
    mockedLookup.mockResolvedValue({ unavailable: true })
    await submitEmail('user@example.com')
    expect(
      await screen.findByText(/temporarily unavailable/i)
    ).toBeInTheDocument()
    // Other half of the non-enumeration lock: an outage must not fall back
    // to the generic "no IdP" copy, so the two states stay distinguishable.
    expect(
      screen.queryByText(/can't determine an identity provider/i)
    ).toBeNull()
    expect(window.location.href).toBe('')
  })

  it('keeps a genuine null and an outage on distinct messages (non-enumeration lock)', async () => {
    // A no-IdP answer must read as the generic "contact your admin" copy,
    // never as the outage retry copy, so an outage can never be mistaken
    // for - or reveal - a real account. Assert the null branch shows the
    // generic message and NOT the outage message.
    mockedLookup.mockResolvedValue({ idp: null })
    await submitEmail('nobody@example.com')
    expect(
      await screen.findByText(/can't determine an identity provider/i)
    ).toBeInTheDocument()
    expect(screen.queryByText(/temporarily unavailable/i)).toBeNull()
  })
})
