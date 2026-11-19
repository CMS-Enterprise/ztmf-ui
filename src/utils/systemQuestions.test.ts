import MockAdapter from 'axios-mock-adapter'

jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: '/api/v1/' }) }
})

import axiosInstance from '@/axiosConfig'
import { apiPaths, queryKeys } from '@/api/keys'
import { fetchSystemQuestions, systemQuestionsQuery } from './systemQuestions'

const mock = new MockAdapter(axiosInstance)
afterEach(() => mock.reset())

const url = apiPaths.fismaSystems.questions(1002, 5)

describe('fetchSystemQuestions', () => {
  it('pins the request to the data call', async () => {
    mock.onGet(url).reply(200, { data: [{ questionid: 900 }] })
    await expect(fetchSystemQuestions(1002, 5)).resolves.toEqual([
      { questionid: 900 },
    ])
  })

  it.each([null, []])(
    'reads %p as no questions (decommissioned system)',
    async (data) => {
      mock.onGet(url).reply(200, { data })
      await expect(fetchSystemQuestions(1002, 5)).resolves.toEqual([])
    }
  )
})

describe('systemQuestionsQuery', () => {
  it('is keyed per system and data call, under the system detail', () => {
    expect(systemQuestionsQuery(1002, 5).queryKey).toEqual(
      queryKeys.fismaSystems.questions(1002, 5)
    )
    expect(systemQuestionsQuery(1002, 5).meta).toEqual({
      suppressErrorNotification: true,
    })
  })
})
