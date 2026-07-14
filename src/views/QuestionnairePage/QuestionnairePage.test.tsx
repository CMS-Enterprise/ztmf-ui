import * as React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

jest.mock('react-router-dom', () => ({
  __esModule: true,
  useNavigate: jest.fn(),
  useLocation: jest.fn(),
  useParams: jest.fn(),
}))

jest.mock('@cmsgov/design-system', () => ({
  __esModule: true,
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  ChoiceList: ({
    choices,
    onChange,
    disabled,
  }: {
    choices: Array<{
      label: React.ReactNode
      value: number
      defaultChecked?: boolean
    }>
    onChange: React.ChangeEventHandler<HTMLInputElement>
    disabled?: boolean
  }) => (
    <div>
      {choices.map((choice) => (
        <label key={choice.value}>
          <input
            type="radio"
            name="radio-choices"
            value={choice.value}
            defaultChecked={choice.defaultChecked}
            disabled={disabled}
            onChange={onChange}
          />
          {choice.label}
        </label>
      ))}
    </div>
  ),
  Spinner: () => <div>Loading</div>,
  ArrowIcon: () => null,
}))

jest.mock('@/axiosConfig', () => ({
  __esModule: true,
  default: { get: jest.fn(), put: jest.fn(), post: jest.fn() },
}))

jest.mock('../Title/Context', () => ({
  __esModule: true,
  useContextProp: jest.fn(),
}))

jest.mock('@/components/BreadCrumbs/BreadCrumbs', () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock('@/components/ConfirmDialog/ConfirmDialog', () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock('@/components/ScoreDiffModal/ScoreDiffModal', () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock('@/components/AISummaryBadge/AISummaryBadge', () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock('./LastEditedFooter', () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock('./InsightsPanel/InsightsPanel', () => ({
  __esModule: true,
  default: () => <div>ZTMF Insights panel</div>,
  OptionInsightBadges: () => <span>ZTMF Insights option badge</span>,
}))
jest.mock('./draftStore', () => ({
  __esModule: true,
  loadDraft: jest.fn(),
  saveDraft: jest.fn(),
  clearDraft: jest.fn(),
}))
jest.mock('@/utils/notify', () => ({
  __esModule: true,
  notify: jest.fn(),
  isAuthHandled: jest.fn(() => false),
}))

import { useLocation, useNavigate, useParams } from 'react-router-dom'
import axiosInstance from '@/axiosConfig'
import { useContextProp } from '../Title/Context'
import { clearDraft, loadDraft, saveDraft } from './draftStore'
import QuestionnarePage from './QuestionnairePage'

const mockedGet = axiosInstance.get as jest.Mock
const mockedPut = axiosInstance.put as jest.Mock
const mockedUseContext = useContextProp as jest.Mock
const mockedUseLocation = useLocation as jest.Mock
const mockedUseNavigate = useNavigate as jest.Mock
const mockedUseParams = useParams as jest.Mock
const mockedLoadDraft = loadDraft as jest.Mock
const mockedSaveDraft = saveDraft as jest.Mock
const mockedClearDraft = clearDraft as jest.Mock

const priorResponse = 'MFA is enforced through Okta policies.'
let insightRows: unknown[]
let insightsResponsePromise: Promise<{ data: { data: unknown[] } }> | undefined

const question = {
  questionid: 1,
  question: 'How does the system authenticate users?',
  notesprompt: 'Explain the authentication mechanisms.',
  pillar: { pillar: 'Identity', pillarid: 1, order: 1 },
  function: {
    functionid: 1,
    function: 'Moon Identity Verification',
    description: 'Authenticate users.',
    datacenterenvironment: 'Other',
  },
}

const carriedForwardScore = {
  scoreid: 501,
  fismasystemid: 1003,
  datecalculated: 0,
  notes: priorResponse,
  functionoptionid: 11,
  datacallid: 103,
  last_edited_at: null,
  last_edited_by: null,
}

function installApiMocks() {
  mockedGet.mockImplementation((url: string) => {
    if (url === 'insights') {
      return (
        insightsResponsePromise ??
        Promise.resolve({ data: { data: insightRows } })
      )
    }
    if (/^\/fismasystems\/\d+\/questions$/.test(url)) {
      return Promise.resolve({ data: { data: [question] } })
    }
    if (url.startsWith('scores?')) {
      return Promise.resolve({ data: { data: [carriedForwardScore] } })
    }
    if (url === 'functions/1/options') {
      return Promise.resolve({
        data: {
          data: [
            {
              description: 'MFA is enforced',
              functionid: 1,
              functionoptionid: 11,
              optionname: 'Initial',
              score: 2,
            },
          ],
        },
      })
    }
    throw new Error(`Unexpected GET ${url}`)
  })
}

beforeEach(() => {
  insightsResponsePromise = undefined
  insightRows = [
    {
      fismasystemid: 1003,
      questionid: 1,
      synced_at: '2026-07-14T00:00:00Z',
      payload: {
        suggested_score: 2,
        suggested_label: 'Initial',
        cfacts_auth_methods: 'IDM-Okta',
        last_score_notes: priorResponse,
        last_datacall: 'FY24 ZTM',
      },
    },
  ]
  mockedUseNavigate.mockReturnValue(jest.fn())
  mockedUseParams.mockReturnValue({ fismaacronym: 'sld-gen' })
  mockedUseLocation.mockReturnValue({
    state: {
      fismasystemid: 1003,
      datacallid: 103,
      datacall: 'FY25 ZTM',
      deadline: '2099-12-31T23:59:59Z',
    },
  })
  mockedUseContext.mockReturnValue({
    userInfo: {
      userid: 'isso-user',
      email: 'isso@example.com',
      fullname: 'Test ISSO',
      role: 'ISSO',
      assignedfismasystems: [],
    },
    selectedDatacall: null,
    latestDataCallId: 103,
    latestDatacall: 'FY25 ZTM',
    latestDeadline: '2099-12-31T23:59:59Z',
    fismaSystems: [
      {
        fismasystemid: 1003,
        fismaacronym: 'SLD-GEN',
        fismaname: 'Shield Generator',
        datacenterenvironment: 'Other',
      },
      {
        fismasystemid: 1004,
        fismaacronym: 'TIE-FTR',
        fismaname: 'TIE Fighter',
        datacenterenvironment: 'Other',
      },
    ],
    datacenterEnvironments: [],
  })
  mockedLoadDraft.mockResolvedValue(null)
  mockedSaveDraft.mockResolvedValue(true)
  mockedClearDraft.mockResolvedValue(undefined)
  mockedPut.mockResolvedValue({ data: {} })
  installApiMocks()
})

describe('QuestionnairePage justification integration', () => {
  it('requires review and persists an explicitly accepted identical prior response', async () => {
    render(<QuestionnarePage />)

    const response = await screen.findByRole('textbox', {
      name: 'Current response',
    })
    expect(response).toHaveValue('')
    expect(screen.getByText('Review required')).toBeInTheDocument()
    expect(screen.queryByText('ZTMF Insights panel')).not.toBeInTheDocument()
    expect(
      screen.queryByText('ZTMF Insights option badge')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Suggested justification')
    ).not.toBeInTheDocument()

    const complete = screen.getByRole('button', { name: 'Complete' })
    expect(complete).toBeDisabled()

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Insert previous ISSO response into current response',
      })
    )
    expect(response).toHaveValue(priorResponse)
    expect(complete).toBeEnabled()

    fireEvent.change(response, {
      target: { value: 'MFA is enforced through phishing-resistant policies.' },
    })
    expect(screen.getByText('Added to response')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', {
        name: "Review again: Last year's response — FY24 ZTM",
      })
    )
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Close previous ISSO response review',
      })
    )
    expect(screen.getByText('Added to response')).toBeInTheDocument()
    fireEvent.change(response, { target: { value: priorResponse } })
    expect(screen.getByText('Added to response')).toBeInTheDocument()
    expect(response).toHaveValue(priorResponse)

    fireEvent.click(complete)

    await waitFor(() =>
      expect(mockedPut).toHaveBeenCalledWith('scores/501', {
        fismasystemid: 1003,
        notes: priorResponse,
        functionoptionid: 11,
        datacallid: 103,
        notes_is_ai_summary: false,
      })
    )
  })

  it('persists a required review after dismissing and manually restoring the prior text', async () => {
    render(<QuestionnarePage />)

    const response = await screen.findByRole('textbox', {
      name: 'Current response',
    })
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Dismiss previous ISSO response',
      })
    )
    expect(response).toHaveValue('')

    fireEvent.change(response, { target: { value: priorResponse } })
    expect(screen.getByText('Added to response')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Complete' }))

    await waitFor(() =>
      expect(mockedPut).toHaveBeenCalledWith('scores/501', {
        fismasystemid: 1003,
        notes: priorResponse,
        functionoptionid: 11,
        datacallid: 103,
        notes_is_ai_summary: false,
      })
    )
  })

  it('blocks submission until the initial Insights lookup settles', async () => {
    let resolveInsights:
      | ((value: { data: { data: unknown[] } }) => void)
      | null = null
    insightsResponsePromise = new Promise((resolve) => {
      resolveInsights = resolve
    })

    render(<QuestionnarePage />)

    const complete = await screen.findByRole('button', { name: 'Complete' })
    expect(screen.getByRole('status')).toHaveTextContent(
      'Checking for prior responses…'
    )
    expect(complete).toBeDisabled()

    await React.act(async () => {
      resolveInsights?.({ data: { data: insightRows } })
    })

    expect(await screen.findByText('Review required')).toBeInTheDocument()
    expect(
      screen.queryByText('Checking for prior responses…')
    ).not.toBeInTheDocument()
    expect(complete).toBeDisabled()
  })

  it('preserves the original four-row textarea when the question has no insight', async () => {
    insightRows = []
    render(<QuestionnarePage />)

    expect(
      await screen.findByText('Explain the authentication mechanisms.')
    ).toBeInTheDocument()
    const response = screen.getByRole('textbox')
    expect(response).toHaveAttribute('rows', '4')
    expect(
      screen.queryByRole('textbox', { name: 'Current response' })
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Current response')).not.toBeInTheDocument()
  })

  it('shows Insights content for a CMS data call', async () => {
    mockedUseLocation.mockReturnValue({
      state: {
        fismasystemid: 1003,
        datacallid: 103,
        datacall: 'FY2025 Q1',
        deadline: '2099-12-31T23:59:59Z',
      },
    })

    render(<QuestionnarePage />)

    expect(await screen.findByText('ZTMF Insights panel')).toBeInTheDocument()
    expect(screen.getByText('ZTMF Insights option badge')).toBeInTheDocument()
    expect(screen.getByText('Suggested justification')).toBeInTheDocument()
    expect(
      screen.getByText("Last year's response — FY24 ZTM")
    ).toBeInTheDocument()
  })

  it('requires a fresh prior-response review after changing systems', async () => {
    const view = render(<QuestionnarePage />)
    await screen.findByText('Review required')
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Dismiss previous ISSO response',
      })
    )
    expect(screen.getByRole('button', { name: 'Complete' })).toBeEnabled()

    mockedUseLocation.mockReturnValue({
      state: {
        fismasystemid: 1004,
        datacallid: 103,
        datacall: 'FY25 ZTM',
        deadline: '2099-12-31T23:59:59Z',
      },
    })
    view.rerender(<QuestionnarePage />)

    expect(await screen.findByText('Review required')).toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: 'Current response' })
    ).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Complete' })).toBeDisabled()
  })
})
