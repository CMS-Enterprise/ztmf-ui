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
import { useDecommissionFlow } from './useDecommissionFlow'

const mock = new MockAdapter(axiosInstance)
const notifyMock = notify as jest.Mock

const system: FismaSystemType = {
  fismasystemid: 7,
  fismaname: 'Imperial Star Destroyer',
  fismaacronym: 'ISD',
  fismauid: 'ISD-001',
} as FismaSystemType

beforeEach(() => {
  mock.reset()
  notifyMock.mockClear()
})

describe('useDecommissionFlow', () => {
  test('resetDecommissionForm clears every field to its open-time defaults', () => {
    const { result } = renderHook(() => useDecommissionFlow())
    act(() => {
      result.current.setDecommissionNotes('Migrated to cloud')
      result.current.setShowDecommissionForm(true)
      result.current.setDecommissionDateError('stale error')
    })
    act(() => result.current.resetDecommissionForm())
    expect(result.current.decommissionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.current.decommissionDateError).toBe('')
    expect(result.current.decommissionNotes).toBe('')
    expect(result.current.showDecommissionForm).toBe(false)
  })

  test('checkDecommissionDate writes inline error + returns false for empty', () => {
    const { result } = renderHook(() => useDecommissionFlow())
    let ok = true
    act(() => {
      ok = result.current.checkDecommissionDate('')
    })
    expect(ok).toBe(false)
    expect(result.current.decommissionDateError).toBe('Date is required')
  })

  test('checkDecommissionDate returns true + clears error for a past date', () => {
    const { result } = renderHook(() => useDecommissionFlow())
    act(() => result.current.setDecommissionDateError('stale'))
    let ok = false
    act(() => {
      ok = result.current.checkDecommissionDate('2020-01-01')
    })
    expect(ok).toBe(true)
    expect(result.current.decommissionDateError).toBe('')
  })

  test('handleDecommission: invalid date bails before any HTTP call', async () => {
    const onClose = jest.fn()
    const { result } = renderHook(() => useDecommissionFlow())
    // Date is '' by default - checkDecommissionDate rejects with "required".
    await act(async () => {
      await result.current.handleDecommission(system, onClose)
    })
    expect(mock.history.delete).toHaveLength(0)
    expect(onClose).not.toHaveBeenCalled()
    expect(result.current.decommissionDateError).toBe('Date is required')
  })

  test('handleDecommission: success path notifies and calls onClose with merged row', async () => {
    mock.onDelete('fismasystems/7').reply(200, { data: null })
    const onClose = jest.fn()
    const { result } = renderHook(() => useDecommissionFlow())
    act(() => result.current.setDecommissionDate('2025-01-15'))
    act(() => result.current.setDecommissionNotes('  decommed  '))

    await act(async () => {
      await result.current.handleDecommission(system, onClose)
    })

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    const passed = onClose.mock.calls[0][0]
    expect(passed.fismasystemid).toBe(7)
    expect(passed.decommissioned).toBe(true)
    expect(passed.decommissioned_date).toMatch(/^2025-01-15T/)
    // Notes get trimmed before they're sent + before the optimistic merge.
    expect(passed.decommissioned_notes).toBe('decommed')
    expect(notifyMock).toHaveBeenCalledWith(
      'System decommissioned successfully',
      'success',
      expect.any(Object)
    )
  })

  test('handleDecommission: 404 surfaces systemNotFound notice and does not call onClose', async () => {
    mock.onDelete('fismasystems/7').reply(404)
    const onClose = jest.fn()
    const { result } = renderHook(() => useDecommissionFlow())
    act(() => result.current.setDecommissionDate('2025-01-15'))

    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    await act(async () => {
      await result.current.handleDecommission(system, onClose)
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
