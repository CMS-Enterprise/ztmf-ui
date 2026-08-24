// Coverage for the questionnaire modal: the load chain (latest
// data call -> questions -> existing scores -> options), answering a question,
// and saving on Next. A regression here fails to load or record answers.

// axiosConfig reads import.meta.env at module load and throws under @swc/jest.
jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: '/api/v1/' }) }
})
jest.mock('@/utils/notify', () => {
  const actual = jest.requireActual('@/utils/notify')
  return { ...actual, notify: jest.fn() }
})

// The modal reads userInfo from the shared Outlet context; a write-admin so the
// form is editable (isReadOnly false) and Next saves.
jest.mock('../Title/Context', () => ({
  useContextProp: () => ({
    userInfo: {
      userid: '1',
      email: 'grand.moff@deathstar.empire',
      fullname: 'Grand Moff Tarkin',
      role: 'OWNER',
    },
  }),
}))

import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import QuestionnareModal from './QuestionnareModal'
import axiosInstance from '@/axiosConfig'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import type { FismaSystemType } from '@/types'

const mock = new MockAdapter(axiosInstance)

const SYSTEM = { fismasystemid: 42 } as unknown as FismaSystemType

// Two functions in one pillar so Next is enabled (it disables on the last step).
const QUESTIONS = [
  {
    questionid: 1,
    question: 'How is identity verified?',
    notesprompt: 'Describe identity verification.',
    pillar: { pillar: 'Identity', pillarid: 1 },
    function: {
      functionid: 10,
      function: 'Identity Verification',
      description: '',
      datacenterenvironment: '',
    },
  },
  {
    questionid: 2,
    question: 'How are devices managed?',
    notesprompt: 'Describe device management.',
    pillar: { pillar: 'Identity', pillarid: 1 },
    function: {
      functionid: 11,
      function: 'Device Management',
      description: '',
      datacenterenvironment: '',
    },
  },
]

const OPTIONS_10 = [
  {
    functionoptionid: 100,
    functionid: 10,
    optionname: 'Traditional',
    description: 'Manual verification',
    score: 1,
  },
  {
    functionoptionid: 101,
    functionid: 10,
    optionname: 'Advanced',
    description: 'Continuous verification',
    score: 4,
  },
]

// A far-future deadline so the modal is not in past-deadline mode.
const LATEST = { datacallid: 5, deadline: '2099-12-31T00:00:00Z' }

beforeEach(() => {
  mock.reset()
  mock.onGet('/datacalls/latest').reply(200, { data: LATEST })
  mock.onGet(/\/fismasystems\/42\/questions/).reply(200, { data: QUESTIONS })
  // No existing scores: the first save is a POST (scoreid 0).
  mock.onGet(/scores\?datacallid=/).reply(200, { data: [] })
  mock.onGet('functions/10/options').reply(200, { data: OPTIONS_10 })
  mock.onGet('functions/11/options').reply(200, { data: [] })
})

test('loads the data-call chain and renders the first question with its options', async () => {
  renderWithProviders(
    <QuestionnareModal open onClose={jest.fn()} system={SYSTEM} />
  )

  expect(
    await screen.findByText('How is identity verified?')
  ).toBeInTheDocument()
  // Options came from functions/10/options, keyed off the first question.
  expect(
    await screen.findByLabelText('Manual verification')
  ).toBeInTheDocument()
  expect(screen.getByLabelText('Continuous verification')).toBeInTheDocument()
})

test('selecting an option and clicking Next POSTs a new score', async () => {
  let postBody: Record<string, unknown> | undefined
  mock.onPost('scores').reply((config) => {
    postBody = JSON.parse(config.data)
    return [201, { data: {} }]
  })
  // handleQuestionnareNext refetches scores after saving.
  mock.onGet(/scores\?fismasystemid=/).reply(200, { data: [] })
  const user = userEvent.setup()

  renderWithProviders(
    <QuestionnareModal open onClose={jest.fn()} system={SYSTEM} />
  )

  await user.click(await screen.findByLabelText('Continuous verification'))
  await user.click(screen.getByRole('button', { name: /Next/ }))

  await waitFor(() => expect(postBody).toBeDefined())
  expect(postBody).toMatchObject({
    fismasystemid: 42,
    functionoptionid: 101,
    datacallid: 5,
  })
})

test('the Close button calls onClose', async () => {
  const onClose = jest.fn()
  const user = userEvent.setup()

  renderWithProviders(
    <QuestionnareModal open onClose={onClose} system={SYSTEM} />
  )

  await screen.findByText('How is identity verified?')
  await user.click(screen.getByRole('button', { name: 'Close' }))

  expect(onClose).toHaveBeenCalled()
})

test('changing an existing answer and clicking Next PUTs the score', async () => {
  // An existing score for the first question means selecting a different option
  // is an edit (PUT scores/:id), not a create.
  mock.onGet(/scores\?datacallid=/).reply(200, {
    data: [
      {
        scoreid: 55,
        fismasystemid: 42,
        functionoptionid: 100,
        notes: 'prior note',
        datacallid: 5,
      },
    ],
  })
  mock.onGet(/scores\?fismasystemid=/).reply(200, { data: [] })
  let putUrl: string | undefined
  mock.onPut(/scores\/55$/).reply((config) => {
    putUrl = config.url
    return [200, {}]
  })
  const user = userEvent.setup()

  renderWithProviders(
    <QuestionnareModal open onClose={jest.fn()} system={SYSTEM} />
  )

  // The prior answer is pre-selected; switch it, then advance.
  await user.click(await screen.findByLabelText('Continuous verification'))
  await user.click(screen.getByRole('button', { name: /Next/ }))

  await waitFor(() => expect(putUrl).toBe('scores/55'))
})

test('Back returns to the previous question', async () => {
  const user = userEvent.setup()

  renderWithProviders(
    <QuestionnareModal open onClose={jest.fn()} system={SYSTEM} />
  )

  // Advance to the second question, then go Back to the first.
  await screen.findByText('How is identity verified?')
  await user.click(screen.getByRole('button', { name: /Next/ }))
  expect(
    await screen.findByText('How are devices managed?')
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Back/ }))
  expect(
    await screen.findByText('How is identity verified?')
  ).toBeInTheDocument()
})
