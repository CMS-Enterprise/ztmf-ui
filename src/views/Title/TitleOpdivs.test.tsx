import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { userData, OpDiv } from '@/types'

// Title-level coverage for #558. The consumer suites inject opdivs into a
// mocked context, so none of them exercise the provide side - they would pass
// even if Title never fetched. Renders the real Title and reads the context off
// an Outlet harness, as TitleDecommissioned.test.tsx does.
jest.mock('react-router-dom', () => ({
  __esModule: true,
  useLoaderData: jest.fn(),
  useLocation: jest.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Outlet: ({
    context,
  }: {
    context: { opdivs: OpDiv[]; refreshOpdivs: () => void }
  }) => (
    <div>
      <button onClick={() => context.refreshOpdivs()}>refresh-opdivs</button>
      <ul>
        {context.opdivs.map((o) => (
          <li key={o.opdiv_id}>{o.code}</li>
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

jest.mock('@/utils/opdivs', () => ({
  __esModule: true,
  fetchOpDivs: jest.fn(),
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
import { fetchOpDivs } from '@/utils/opdivs'
import { clearOtherUserDrafts } from '@/views/QuestionnairePage/draftStore'
import { notify } from '@/utils/notify'
import Title from './Title'

const mockedUseLoaderData = useLoaderData as jest.Mock
const mockedUseLocation = useLocation as jest.Mock
const mockedGet = axiosInstance.get as jest.Mock
const mockedPost = axiosInstance.post as jest.Mock
const mockedFetchEnvs = fetchDataCenterEnvironments as jest.Mock
const mockedFetchOpDivs = fetchOpDivs as jest.Mock
const mockedClearDrafts = clearOtherUserDrafts as jest.Mock
const mockedNotify = notify as jest.Mock

const USER: userData = {
  userid: '11111111-1111-1111-1111-111111111111',
  email: 'grand.moff@deathstar.empire',
  fullname: 'Grand Moff Tarkin',
  role: 'OWNER',
  assignedfismasystems: [],
}

const CMS: OpDiv = {
  opdiv_id: 1,
  code: 'CMS',
  name: 'Centers for Medicare & Medicaid Services',
  is_parent: false,
  active: true,
  system_delegate_enabled: false,
}
// Inactive on purpose: the context holds the includeInactive superset.
const RETIRED: OpDiv = {
  opdiv_id: 2,
  code: 'RETIRED',
  name: 'Deactivated OpDiv',
  is_parent: false,
  active: false,
  system_delegate_enabled: false,
}

const originalLocation = window.location

beforeEach(() => {
  mockedUseLoaderData.mockReset()
  mockedUseLocation.mockReset()
  mockedUseLoaderData.mockReturnValue({ status: 200, response: USER })
  mockedUseLocation.mockReturnValue({ pathname: '/' })
  mockedGet.mockResolvedValue({ data: { data: [] } })
  mockedPost.mockResolvedValue({ status: 204 })
  mockedFetchEnvs.mockResolvedValue([])
  mockedFetchOpDivs.mockResolvedValue([CMS, RETIRED])
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

describe('Title — shared OpDiv context (#558)', () => {
  it('fetches the inactive-inclusive list once and puts it on the Outlet context', async () => {
    render(<Title />)

    expect(await screen.findByText('CMS')).toBeInTheDocument()
    expect(screen.getByText('RETIRED')).toBeInTheDocument()
    // One fetch for the whole layout - the point of the issue.
    expect(mockedFetchOpDivs).toHaveBeenCalledTimes(1)
    expect(mockedFetchOpDivs).toHaveBeenCalledWith(true, expect.anything())
  })

  it('does not fetch when the session loader did not authenticate', () => {
    mockedUseLoaderData.mockReturnValue({ status: 401, response: undefined })

    render(<Title />)

    expect(mockedFetchOpDivs).not.toHaveBeenCalled()
  })

  it('refreshOpdivs refetches so a mutation is reflected in the shared copy', async () => {
    render(<Title />)
    expect(await screen.findByText('CMS')).toBeInTheDocument()

    mockedFetchOpDivs.mockResolvedValue([
      CMS,
      RETIRED,
      { ...CMS, opdiv_id: 3, code: 'NEWLY_CREATED' },
    ])
    fireEvent.click(screen.getByRole('button', { name: 'refresh-opdivs' }))

    expect(await screen.findByText('NEWLY_CREATED')).toBeInTheDocument()
    expect(mockedFetchOpDivs).toHaveBeenCalledTimes(2)
  })

  it('surfaces a failed load rather than leaving consumers silently empty', async () => {
    mockedFetchOpDivs.mockRejectedValue(new Error('network'))

    render(<Title />)

    // No second fetch site to recover on, so the user has to be told to reload.
    await waitFor(() =>
      expect(mockedNotify).toHaveBeenCalledWith(
        expect.stringMatching(/opdiv/i),
        'error'
      )
    )
    expect(mockedFetchOpDivs).toHaveBeenCalledTimes(1)
  })
})
