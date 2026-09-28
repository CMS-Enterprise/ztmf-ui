import { renderHook, waitFor } from '@testing-library/react'
import MockAdapter from 'axios-mock-adapter'

jest.mock('@/router/router', () => ({
  __esModule: true,
  default: { navigate: jest.fn() },
}))
jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: '/api/v1/' }) }
})

import axiosInstance from '@/axiosConfig'
import { useUserNameLookup } from './useUserNameLookup'

const mock = new MockAdapter(axiosInstance)

beforeEach(() => {
  mock.reset()
})

describe('useUserNameLookup', () => {
  test('returns the fullname from /users/{userid}.fullname when enabled', async () => {
    mock.onGet('users/42').reply(200, { data: { fullname: 'Leia Organa' } })

    const { result } = renderHook(() => useUserNameLookup('42', true))

    await waitFor(() => expect(result.current).toBe('Leia Organa'))
  })

  test('returns "" when disabled (panel closed)', async () => {
    mock.onGet('users/42').reply(200, { data: { fullname: 'Leia Organa' } })

    const { result } = renderHook(() => useUserNameLookup('42', false))
    // Yield once so any pending effect would have fired.
    await new Promise((r) => setTimeout(r, 0))
    expect(result.current).toBe('')
    expect(mock.history.get).toHaveLength(0)
  })

  test('returns "" when userid is falsy', async () => {
    const { result } = renderHook(() =>
      useUserNameLookup(undefined as unknown as string, true)
    )
    await new Promise((r) => setTimeout(r, 0))
    expect(result.current).toBe('')
    expect(mock.history.get).toHaveLength(0)
  })

  test('falls back to the userid itself when the response has no fullname', async () => {
    mock.onGet('users/77').reply(200, { data: {} })

    const { result } = renderHook(() => useUserNameLookup('77', true))
    await waitFor(() => expect(result.current).toBe('77'))
  })

  test('falls back to the userid on network error', async () => {
    mock.onGet('users/99').networkError()

    const { result } = renderHook(() => useUserNameLookup('99', true))
    await waitFor(() => expect(result.current).toBe('99'))
  })

  test('refetches when userid changes', async () => {
    mock.onGet('users/1').reply(200, { data: { fullname: 'Han Solo' } })
    mock.onGet('users/2').reply(200, { data: { fullname: 'Luke Skywalker' } })

    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useUserNameLookup(id, true),
      { initialProps: { id: '1' } }
    )
    await waitFor(() => expect(result.current).toBe('Han Solo'))

    rerender({ id: '2' })
    await waitFor(() => expect(result.current).toBe('Luke Skywalker'))
  })
})
