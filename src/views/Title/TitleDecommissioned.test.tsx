import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { userData } from '@/types'

// Title-level integration test for #572 (follow-up to #569 / #566).
//
// #569's QuickSearchToolbar unit tests lock in that "Clear filters" calls
// setShowDecommissioned(false). But the behavior that actually drops the
// decommissioned rows is Title's refetch effect — fetchFismaSystems keyed on
// showDecommissioned — which no unit test exercises. This test renders the REAL
// Title so that effect runs, and drives showDecommissioned through the real
// Outlet context to assert the fetch hits the unparameterized GET /fismasystems
// on clear (and ?decommissioned=true when enabled), with rows added/dropped.
//
// Mock setup mirrors Title.test.tsx, except Outlet renders a lightweight harness
// that consumes the passed context (Title's real setShowDecommissioned + live
// fismaSystems) — standing in for the deep Home > FismaTable > DataGrid subtree
// so the test targets Title's refetch, not the DataGrid.
jest.mock('react-router-dom', () => ({
  __esModule: true,
  useLoaderData: jest.fn(),
  useLocation: jest.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Outlet: ({
    context,
  }: {
    context: {
      fismaSystems: { fismasystemid: number; fismaname: string }[]
      setShowDecommissioned: (show: boolean) => void
    }
  }) => (
    <div>
      {/* Drive the context setter the way the real controls do: the toggle
          calls setShowDecommissioned(true); Clear filters calls (false). */}
      <button onClick={() => context.setShowDecommissioned(true)}>
        show-decommissioned
      </button>
      <button onClick={() => context.setShowDecommissioned(false)}>
        clear-filters
      </button>
      <ul>
        {context.fismaSystems.map((s) => (
          <li key={s.fismasystemid}>{s.fismaname}</li>
        ))}
      </ul>
    </div>
  ),
}))

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

jest.mock('@/utils/notify', () => ({
  __esModule: true,
  notify: jest.fn(),
  isAuthHandled: jest.fn(),
}))

// Heavy children this test doesn't depend on (mirrors Title.test.tsx).
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

const USER: userData = {
  userid: '11111111-1111-1111-1111-111111111111',
  email: 'grand.moff@deathstar.empire',
  fullname: 'Grand Moff Tarkin',
  role: 'OWNER',
  assignedfismasystems: [],
}

const ACTIVE = [
  { fismasystemid: 1, fismaname: 'Active Alpha' },
  { fismasystemid: 2, fismaname: 'Active Bravo' },
]
const WITH_DECOMMISSIONED = [
  ...ACTIVE,
  { fismasystemid: 3, fismaname: 'Decommissioned Zeta' },
]

// The system endpoint the current assertion cares about — active-only vs the
// decommissioned-inclusive variant.
const fismaSystemsCalls = () =>
  mockedGet.mock.calls
    .map((c) => c[0] as string)
    .filter((u) => typeof u === 'string' && u.startsWith('/fismasystems'))

const originalLocation = window.location

beforeEach(() => {
  mockedUseLoaderData.mockReset()
  mockedUseLocation.mockReset()
  mockedUseLoaderData.mockReturnValue({ status: 200, response: USER })
  mockedUseLocation.mockReturnValue({ pathname: '/' })

  mockedGet.mockImplementation((url: string) => {
    if (url === '/fismasystems')
      return Promise.resolve({ data: { data: ACTIVE } })
    if (url === '/fismasystems?decommissioned=true')
      return Promise.resolve({ data: { data: WITH_DECOMMISSIONED } })
    // /datacalls and anything else the mount touches — empty is fine.
    return Promise.resolve({ data: { data: [] } })
  })
  mockedPost.mockResolvedValue({ status: 204 })
  mockedFetchEnvs.mockResolvedValue([])
  mockedClearDrafts.mockResolvedValue(undefined)

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

describe('Title — Clear filters drops decommissioned rows via refetch (#572)', () => {
  it('refetches the unparameterized endpoint on clear, dropping decommissioned rows', async () => {
    render(<Title />)

    // 1. Mount: active-only load against the unparameterized endpoint.
    expect(await screen.findByText('Active Alpha')).toBeInTheDocument()
    expect(fismaSystemsCalls()).toContain('/fismasystems')
    expect(fismaSystemsCalls()).not.toContain(
      '/fismasystems?decommissioned=true'
    )
    expect(screen.queryByText('Decommissioned Zeta')).not.toBeInTheDocument()

    // 2. Enable Show Decommissioned: refetch hits the parameterized endpoint and
    //    the decommissioned row appears.
    fireEvent.click(screen.getByRole('button', { name: 'show-decommissioned' }))
    expect(await screen.findByText('Decommissioned Zeta')).toBeInTheDocument()
    expect(fismaSystemsCalls()).toContain('/fismasystems?decommissioned=true')

    // 3. Clear filters (setShowDecommissioned(false)): the refetch fires against
    //    the UNPARAMETERIZED endpoint and the decommissioned row leaves the grid.
    fireEvent.click(screen.getByRole('button', { name: 'clear-filters' }))
    await waitFor(() =>
      expect(screen.queryByText('Decommissioned Zeta')).not.toBeInTheDocument()
    )
    // The most recent systems fetch was the plain endpoint, not ?decommissioned.
    const calls = fismaSystemsCalls()
    expect(calls[calls.length - 1]).toBe('/fismasystems')
    expect(screen.getByText('Active Alpha')).toBeInTheDocument()
  })
})
