import { screen } from '@testing-library/react'
import MockAdapter from 'axios-mock-adapter'

// Same import-meta dance as the other view tests.
jest.mock('@/router/router', () => ({
  __esModule: true,
  default: { navigate: jest.fn() },
}))
jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: '/api/v1/' }) }
})

const ctx = {
  userInfo: { userid: 'me', role: 'OWNER', email: 'me@x.gov', fullname: 'Me' },
  selectedDatacall: null,
  setSelectedDatacall: jest.fn(),
  latestDataCallId: 1,
  latestDatacall: 'FY2025',
  latestDeadline: '',
  datacalls: [
    {
      datacallid: 1,
      datacall: 'FY2025',
      datecreated: '2025-01-01',
      deadline: '2026-12-31',
    },
  ],
  fismaSystems: [
    {
      fismasystemid: 42,
      fismaname: 'Imperial Star Destroyer',
      fismaacronym: 'ISD',
      datacenterenvironment: 'on-prem',
    },
  ],
  setFismaSystems: jest.fn(),
  showDecommissioned: false,
  setShowDecommissioned: jest.fn(),
  fetchFismaSystems: jest.fn(),
  dashboardSearch: '',
  setDashboardSearch: jest.fn(),
}
jest.mock('../Title/Context', () => ({
  useContextProp: () => ctx,
}))

// useParams supplies the system acronym from the URL; useLocation supplies
// the fismasystemid in router state. Mock both so the page's effect sees a
// real system id.
const useParamsMock = jest.fn()
const useLocationMock = jest.fn()
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom')
  return {
    ...actual,
    useParams: () => useParamsMock(),
    useLocation: () => useLocationMock(),
  }
})

import axiosInstance from '@/axiosConfig'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import QuestionnairePage from './QuestionnairePage'

const mock = new MockAdapter(axiosInstance)

beforeEach(() => {
  mock.reset()
  useParamsMock.mockReturnValue({ fismaacronym: 'ISD' })
  useLocationMock.mockReturnValue({
    pathname: '/questionnaire/isd',
    state: { fismasystemid: 42 },
  })
})

describe('QuestionnairePage', () => {
  test('renders the "no questions" guard when the system has no questionnaire (decommissioned)', async () => {
    // Backend returns null for a system whose data-center environment is out
    // of scope - the page must surface the friendly notice instead of
    // crashing in the categoriesData[0] access path.
    mock.onGet('/fismasystems/42/questions').reply(200, { data: null })

    renderWithProviders(<QuestionnairePage />)

    expect(
      await screen.findByText(/no questionnaire is available for this system/i)
    ).toBeInTheDocument()
  })

  test('renders the direct-link guard when router state is missing', () => {
    useLocationMock.mockReturnValue({
      pathname: '/questionnaire/isd',
      state: null,
    })
    renderWithProviders(<QuestionnairePage />)
    expect(
      screen.getByText(/cannot load questionnaire from a direct link/i)
    ).toBeInTheDocument()
  })

  test('loads the first question after the /questions fetch resolves', async () => {
    // Minimal happy-path fixture: one pillar, one function, one question.
    // The page picks the first function under the first pillar and renders
    // its question text + notes prompt.
    mock.onGet('/fismasystems/42/questions').reply(200, {
      data: [
        {
          questionid: 9001,
          question: 'Do you require phishing-resistant MFA for every login?',
          notesprompt: 'Document the MFA policy citation here.',
          pillar: { pillar: 'Identity' },
          function: {
            functionid: 700,
            function: 'AuthN',
            description: 'Authentication function description.',
          },
        },
      ],
    })
    mock
      .onGet('scores?datacallid=1&fismasystemid=42&include=functionoption')
      .reply(200, { data: [] })

    renderWithProviders(<QuestionnairePage />)

    expect(
      await screen.findByText(
        /do you require phishing-resistant mfa for every login\?/i
      )
    ).toBeInTheDocument()
  })
})
