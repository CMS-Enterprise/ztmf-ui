import MockAdapter from 'axios-mock-adapter'

jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: '/api/v1/' }) }
})

import axiosInstance from '@/axiosConfig'
import { queryKeys } from '@/api/keys'
import { fetchFunctionOptions, functionOptionsQuery } from './functionOptions'

const mock = new MockAdapter(axiosInstance)
afterEach(() => mock.reset())

describe('fetchFunctionOptions', () => {
  it('unwraps the envelope in server order', async () => {
    const rows = [
      { functionoptionid: 2, description: 'b', score: 2 },
      { functionoptionid: 1, description: 'a', score: 1 },
    ]
    mock.onGet('/functions/7006/options').reply(200, { data: rows })
    await expect(fetchFunctionOptions(7006)).resolves.toEqual(rows)
  })

  it('reads a null envelope as no options', async () => {
    mock.onGet('/functions/7006/options').reply(200, { data: null })
    await expect(fetchFunctionOptions(7006)).resolves.toEqual([])
  })
})

describe('functionOptionsQuery', () => {
  it('uses the shared key and keeps failures out of the toast', () => {
    const opts = functionOptionsQuery(7006)
    expect(opts.queryKey).toEqual(queryKeys.functionOptions(7006))
    expect(opts.meta).toEqual({ suppressErrorNotification: true })
  })
})
