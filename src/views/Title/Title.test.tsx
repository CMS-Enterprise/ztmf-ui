import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { userData, UserRole } from '@/types'
import { Routes } from '@/router/constants'

// Title reads its session off the data-router loader via useLoaderData, which
// a plain MemoryRouter (renderWithProviders) does not provide - see the
// renderWithProviders caveat about the production hash router. So, like
// LoginPage.test, react-router-dom is mocked module-wide and the loader /
// location are driven per-test. Link and Outlet are stubbed to bare wrappers
// because the account menu and page body only need to render, not navigate.
jest.mock('react-router-dom', () => ({
  __esModule: true,
  useLoaderData: jest.fn(),
  useLocation: jest.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Outlet: () => <div>OUTLET</div>,
}))

// The header does a burst of reference-data fetches on mount (systems,
// datacalls) and posts to the logout endpoint on sign-out. Mock the axios
// instance so nothing hits the network and the logout POST is observable.
jest.mock('@/axiosConfig', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}))

jest.mock('@/utils/dataCenterEnvironments', () => ({
  __esModule: true,
  fetchDataCenterEnvironments: jest.fn(),
}))

jest.mock('@/views/QuestionnairePage/draftStore', () => ({
  __esModule: true,
  clearOtherUserDrafts: jest.fn(),
}))

// Heavy children the logout affordance does not depend on. Stubbing them keeps
// the test focused on the header menu and avoids their own asset/network deps.
jest.mock('@/components/EmailModal/EmailModal', () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock('@/views/EditSystemModal/EditSystemModal', () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock('@/views/DatacallModal/DataCallModal', () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock('@/components/Footer/Footer', () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock('@/components/DevEnvironmentBanner/DevEnvironmentBanner', () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock('@/views/LoginPage/LoginPage', () => ({
  __esModule: true,
  default: () => <div>LOGINPAGE</div>,
}))
jest.mock('@/views/ServerErrorPage/ServerErrorPage', () => ({
  __esModule: true,
  default: () => null,
}))

// fileTransform.cjs returns the pre-Jest-28 raw-string contract, so a real PNG
// import errors during transform; stub the header logo the same way
// LoginPage.test stubs its own.
jest.mock('@/assets/ztmf-logo-color.png', () => 'ztmf-logo-color.png', {
  virtual: true,
})

import { useLoaderData, useLocation } from 'react-router-dom'
import axiosInstance from '@/axiosConfig'
import { fetchDataCenterEnvironments } from '@/utils/dataCenterEnvironments'
import { clearOtherUserDrafts } from '@/views/QuestionnairePage/draftStore'
import Title from './Title'

const mockedUseLoaderData = useLoaderData as jest.Mock
const mockedUseLocation = useLocation as jest.Mock
const mockedGet = axiosInstance.get as jest.Mock
const mockedPost = axiosInstance.post as jest.Mock
const mockedFetchEnvs = fetchDataCenterEnvironments as jest.Mock
const mockedClearDrafts = clearOtherUserDrafts as jest.Mock

function makeUser(role: UserRole): userData {
  return {
    userid: '11111111-1111-1111-1111-111111111111',
    email: 'user@example.com',
    fullname: 'Test User',
    role,
    assignedfismasystems: [],
  }
}

function renderTitleFor(role: UserRole) {
  mockedUseLoaderData.mockReturnValue({ status: 200, response: makeUser(role) })
  mockedUseLocation.mockReturnValue({ pathname: '/' })
  render(<Title />)
}

const originalLocation = window.location

beforeEach(() => {
  // resetMocks: true wipes every mock's implementation before each test, so
  // (re)install the return values the mount effects and logout flow depend on
  // here rather than in the module factories.
  mockedUseLoaderData.mockReset()
  mockedUseLocation.mockReset()
  // Mount effects fetch reference data; resolve everything to empty payloads.
  mockedGet.mockResolvedValue({ data: { data: [] } })
  mockedPost.mockResolvedValue({ status: 204 })
  mockedFetchEnvs.mockResolvedValue([])
  mockedClearDrafts.mockResolvedValue(undefined)
  // jsdom forbids assigning window.location.hash / calling reload on the real
  // object; swap in a writable stub so the logout redirect is observable.
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { hash: '', reload: jest.fn() },
  })
})

afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: originalLocation,
  })
})

describe('Title logout affordance', () => {
  it('renders the account menu with Log out for an admin user', async () => {
    renderTitleFor('OWNER')

    await userEvent.click(screen.getByRole('button', { name: /account menu/i }))

    expect(
      await screen.findByRole('menuitem', { name: /log out/i })
    ).toBeInTheDocument()
  })

  it('renders the account menu with Log out for a non-admin user', async () => {
    // Logout must reach users who previously got no menu at all because it
    // was gated on hasAdminRead - non-admins had no signout affordance.
    renderTitleFor('ISSO')

    await userEvent.click(screen.getByRole('button', { name: /account menu/i }))

    expect(
      await screen.findByRole('menuitem', { name: /log out/i })
    ).toBeInTheDocument()
    // Admin-only items stay gated - a non-admin sees Dashboard + Log out only.
    expect(
      screen.queryByRole('menuitem', { name: /^users$/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('menuitem', { name: /add fisma system/i })
    ).not.toBeInTheDocument()
  })

  it('calls the logout endpoint and lands the user on the sign-in page', async () => {
    renderTitleFor('ISSO')

    await userEvent.click(screen.getByRole('button', { name: /account menu/i }))
    await userEvent.click(
      await screen.findByRole('menuitem', { name: /log out/i })
    )

    await waitFor(() => expect(mockedPost).toHaveBeenCalledWith('/auth/logout'))
    await waitFor(() =>
      expect(window.location.reload as jest.Mock).toHaveBeenCalled()
    )
    expect(window.location.hash).toBe(Routes.SIGNIN)
  })

  it('still redirects to sign-in when the logout request fails', async () => {
    // Logout is best-effort: a failed call must not strand the user in a
    // signed-in-looking shell. It logs and drops them to sign-in anyway.
    mockedPost.mockRejectedValueOnce(new Error('network'))
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    renderTitleFor('ISSO')

    await userEvent.click(screen.getByRole('button', { name: /account menu/i }))
    await userEvent.click(
      await screen.findByRole('menuitem', { name: /log out/i })
    )

    await waitFor(() =>
      expect(window.location.reload as jest.Mock).toHaveBeenCalled()
    )
    expect(window.location.hash).toBe(Routes.SIGNIN)
    errSpy.mockRestore()
  })
})
