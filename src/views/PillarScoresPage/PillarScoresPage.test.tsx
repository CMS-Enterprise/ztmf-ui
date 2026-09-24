import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import PillarScoresPage from './PillarScoresPage'
import type { userData } from '@/types'

jest.mock('@/axiosConfig', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}))
const mockGet = require('@/axiosConfig').default.get as jest.Mock

const selectedDatacall = {
  datacallid: 3,
  datacall: 'FY2025 Q3',
  datecreated: '2025-01-01T12:00:00Z',
  deadline: '2025-05-07T12:00:00Z',
}

const mockContext = {
  fismaSystems: [
    {
      fismasystemid: 1002,
      fismaacronym: 'SSD-EX',
      fismaname: 'Super Star Destroyer Executor Command Systems',
    },
  ],
  selectedDatacall,
  setFismaSystems: jest.fn(),
  setSelectedDatacall: jest.fn(),
  toggleActiveDatacall: jest.fn(),
  latestDataCallId: 5,
  datacalls: [
    selectedDatacall,
    {
      datacallid: 5,
      datacall: 'Audit Fields Smoke Cycle',
      datecreated: '2026-01-01T12:00:00Z',
      deadline: '2099-12-31T12:00:00Z',
    },
  ],
  activeDatacallIds: [3],
  userInfo: {
    userid: '1',
    email: 'admiral.piett@executor.empire',
    fullname: 'Admiral Firmus Piett',
    role: 'ISSO',
  } as userData,
}

jest.mock('../Title/Context', () => ({
  useContextProp: () => mockContext,
}))

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockResolvedValue({ data: { data: [] } })
})

it('routes back to system info for this system', async () => {
  const router = createMemoryRouter(
    [
      {
        path: '/systems/:fismasystemid/pillar-scores',
        element: <PillarScoresPage />,
      },
      {
        path: '/systems/:fismasystemid',
        element: <div>system info</div>,
      },
    ],
    { initialEntries: ['/systems/1002/pillar-scores'] }
  )
  render(<RouterProvider router={router} />)

  await userEvent.click(
    await screen.findByRole('link', { name: 'System Info' })
  )

  expect(router.state.location.pathname).toBe('/systems/1002')
})

it('routes to the selected data call questionnaire for this system', async () => {
  const router = createMemoryRouter(
    [
      {
        path: '/systems/:fismasystemid/pillar-scores',
        element: <PillarScoresPage />,
      },
      {
        path: '/questionnaire/system/:fismasystemid/:datacallid?',
        element: <div>questionnaire</div>,
      },
    ],
    { initialEntries: ['/systems/1002/pillar-scores'] }
  )
  render(<RouterProvider router={router} />)

  await userEvent.click(
    await screen.findByRole('link', { name: 'Questionnaire' })
  )

  // Keyed on the system id, so the URL alone names the system; route state
  // only carries the chosen data call.
  expect(router.state.location.pathname).toBe(
    '/questionnaire/system/1002/FY2025_Q3'
  )
  expect(router.state.location.state).toEqual({
    datacallid: 3,
    datacall: 'FY2025 Q3',
    deadline: '2025-05-07T12:00:00Z',
  })
})

it('resolves a system missing from the active list by id instead of leaking the placeholder', async () => {
  // A decommissioned system or deep link is absent from the active-only
  // context list; the page must fetch it by id rather than render "System".
  mockGet.mockImplementation((url: string) => {
    if (url === '/fismasystems/1001') {
      return Promise.resolve({
        data: {
          data: {
            fismasystemid: 1001,
            fismaacronym: 'DS',
            fismaname: 'Death Star',
          },
        },
      })
    }
    return Promise.resolve({ data: { data: [] } })
  })
  const router = createMemoryRouter(
    [
      {
        path: '/systems/:fismasystemid/pillar-scores',
        element: <PillarScoresPage />,
      },
    ],
    { initialEntries: ['/systems/1001/pillar-scores'] }
  )
  render(<RouterProvider router={router} />)

  await waitFor(() =>
    expect(mockGet).toHaveBeenCalledWith(
      '/fismasystems/1001',
      expect.anything()
    )
  )
  expect(mockContext.setFismaSystems).toHaveBeenCalledWith(expect.any(Function))
})

it('keeps the comparison modal independent from the selected data call', async () => {
  mockGet.mockImplementation((url: string) => {
    if (url.startsWith('/scores/aggregate')) {
      return Promise.resolve({
        data: {
          data: [
            { datacallid: 3, systemscore: 3, pillarscores: [] },
            { datacallid: 5, systemscore: 2, pillarscores: [] },
          ],
        },
      })
    }
    if (url === '/datacalls') {
      return Promise.resolve({ data: { data: mockContext.datacalls } })
    }
    return Promise.resolve({ data: { data: [] } })
  })
  const router = createMemoryRouter(
    [
      {
        path: '/systems/:fismasystemid/pillar-scores',
        element: <PillarScoresPage />,
      },
    ],
    { initialEntries: ['/systems/1002/pillar-scores'] }
  )
  render(<RouterProvider router={router} />)

  await userEvent.click(
    await screen.findByRole('button', { name: 'Compare datacalls' })
  )
  await screen.findByRole('dialog')

  expect(mockContext.setSelectedDatacall).not.toHaveBeenCalled()
})
