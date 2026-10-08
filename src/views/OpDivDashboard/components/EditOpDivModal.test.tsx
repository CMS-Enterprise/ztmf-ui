import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import type { OpDiv } from '@/types'

jest.mock('@/axiosConfig', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}))

const calls: string[] = []
const mockUpdate = jest.fn()
const mockDelegate = jest.fn()
jest.mock('@/utils/opdivs', () => ({
  useUpdateOpDiv: () => ({ mutateAsync: mockUpdate, isPending: false }),
}))
jest.mock('@/utils/delegates', () => ({
  useSetOpDivDelegateEnabled: () => ({
    mutateAsync: mockDelegate,
    isPending: false,
  }),
}))
const mockNotify = jest.fn()
jest.mock('@/utils/notify', () => ({
  isAuthHandled: () => false,
  notify: (...args: unknown[]) => mockNotify(...args),
}))

import EditOpDivModal from './EditOpDivModal'

const OPDIV: OpDiv = {
  opdiv_id: 7,
  code: 'NIH',
  name: 'National Institutes of Health',
  is_parent: false,
  active: true,
  system_delegate_enabled: false,
  insights_enabled: false,
}

const fieldError = () =>
  Object.assign(new Error('bad'), {
    isAxiosError: true,
    response: { status: 400, data: { data: { code: 'code already in use' } } },
  })

beforeEach(() => {
  calls.length = 0
  mockUpdate.mockReset().mockImplementation(async () => {
    calls.push('identity')
  })
  mockDelegate.mockReset().mockImplementation(async () => {
    calls.push('delegate')
  })
  mockNotify.mockReset()
})

const renderModal = (opdiv: OpDiv = OPDIV, onClose = jest.fn()) =>
  renderWithProviders(
    <EditOpDivModal
      open
      onClose={onClose}
      opdiv={opdiv}
      canManage
      canToggleDelegate
    />
  )

describe('EditOpDivModal', () => {
  it('saves identity before the delegate toggle', async () => {
    renderModal()
    await userEvent.click(screen.getByLabelText('System Delegate role'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(calls).toEqual(['identity', 'delegate']))
  })

  it('commits nothing when identity fails validation', async () => {
    mockUpdate.mockRejectedValue(fieldError())
    renderModal()
    await userEvent.click(screen.getByLabelText('System Delegate role'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled())
    expect(mockDelegate).not.toHaveBeenCalled()
  })

  it('says which part saved when only the toggle fails', async () => {
    mockDelegate.mockRejectedValue(new Error('boom'))
    const onClose = jest.fn()
    renderModal(OPDIV, onClose)
    await userEvent.click(screen.getByLabelText('System Delegate role'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        expect.stringMatching(/^Saved code, name.*but not the System Delegate/),
        'error'
      )
    )
  })

  it('keeps typed values when the same OpDiv refetches mid-edit', async () => {
    const { rerender } = renderModal()
    const code = screen.getByLabelText('Code')
    await userEvent.clear(code)
    await userEvent.type(code, 'NIHX')
    // The delegate toggle's invalidation hands back a fresh object.
    rerender(
      <EditOpDivModal
        open
        onClose={jest.fn()}
        opdiv={{ ...OPDIV, system_delegate_enabled: true }}
        canManage
        canToggleDelegate
      />
    )
    expect(screen.getByLabelText('Code')).toHaveValue('NIHX')
  })
})
