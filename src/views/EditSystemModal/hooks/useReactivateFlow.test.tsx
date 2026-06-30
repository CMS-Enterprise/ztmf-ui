import { act, renderHook, waitFor } from '@testing-library/react'
import MockAdapter from 'axios-mock-adapter'
import type { FismaSystemType } from '@/types'

jest.mock('@/router/router', () => ({
  __esModule: true,
  default: { navigate: jest.fn() },
}))
jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: '/api/v1/' }) }
})
jest.mock('@/utils/notify', () => ({
  isAuthHandled: jest.fn().mockReturnValue(false),
  notify: jest.fn(),
}))

import axiosInstance from '@/axiosConfig'
import { notify } from '@/utils/notify'
import { useReactivateFlow } from './useReactivateFlow'

const mock = new MockAdapter(axiosInstance)
const notifyMock = notify as jest.Mock

const system: FismaSystemType = {
  fismasystemid: 9,
  fismaname: 'Death Star',
  fismaacronym: 'DS',
  fismauid: 'DS-001',
  decommissioned: true,
} as FismaSystemType

beforeEach(() => {
  mock.reset()
  notifyMock.mockClear()
})

describe('useReactivateFlow', () => {
  test('resetReactivateForm clears notes and closes the sub-form', () => {
    const { result } = renderHook(() => useReactivateFlow())
    act(() => {
      result.current.setReactivationNotes('Back online')
      result.current.setShowReactivateForm(true)
    })
    act(() => result.current.resetReactivateForm())
    expect(result.current.reactivationNotes).toBe('')
    expect(result.current.showReactivateForm).toBe(false)
  })

  test('handleReactivate: success path calls onClose with merged row', async () => {
    mock.onPut('fismasystems/9/reactivate').reply(200, { data: null })
    const onClose = jest.fn()
    const { result } = renderHook(() => useReactivateFlow())
    act(() => result.current.setReactivationNotes('  re-enabled  '))

    await act(async () => {
      await result.current.handleReactivate(system, onClose)
    })

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    const passed = onClose.mock.calls[0][0]
    expect(passed.fismasystemid).toBe(9)
    expect(passed.decommissioned).toBe(false)
    expect(passed.reactivation_notes).toBe('re-enabled')
    expect(notifyMock).toHaveBeenCalledWith(
      'System reactivated successfully',
      'success',
      expect.any(Object)
    )
  })

  test('handleReactivate: sends no body when notes are empty', async () => {
    mock.onPut('fismasystems/9/reactivate').reply((config) => {
      // Empty notes -> body is undefined (no `notes` key sent).
      expect(config.data).toBeUndefined()
      return [200, { data: null }]
    })
    const onClose = jest.fn()
    const { result } = renderHook(() => useReactivateFlow())
    await act(async () => {
      await result.current.handleReactivate(system, onClose)
    })
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  test('handleReactivate: 404 surfaces systemNotFound notice and does not call onClose', async () => {
    mock.onPut('fismasystems/9/reactivate').reply(404)
    const onClose = jest.fn()
    const { result } = renderHook(() => useReactivateFlow())

    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    await act(async () => {
      await result.current.handleReactivate(system, onClose)
    })
    expect(onClose).not.toHaveBeenCalled()
    expect(notifyMock).toHaveBeenCalledWith(
      'System not found',
      'error',
      expect.any(Object)
    )
    errSpy.mockRestore()
  })
})
