import { screen } from '@testing-library/react'
import { Route, Routes, useParams } from 'react-router-dom'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import type { OpDiv, userData } from '@/types'

const opdiv = (opdiv_id: number, code: string): OpDiv => ({
  opdiv_id,
  code,
  name: code,
  is_parent: false,
  active: true,
  system_delegate_enabled: false,
})

let mockContext: Record<string, unknown>
jest.mock('../Title/Context', () => ({
  useContextProp: () => mockContext,
}))

import OpDivIndexRedirect from './OpDivIndexRedirect'

const Landed = () => <p>landed on {useParams().id}</p>

const admin: userData = {
  userid: 'u1',
  email: 'a@example.gov',
  fullname: 'A',
  role: 'OPDIV_ADMIN',
  assignedopdivids: [7, 9],
}

beforeEach(() => {
  window.sessionStorage.clear()
  mockContext = {
    opdivs: [opdiv(7, 'NIH'), opdiv(9, 'CDC')],
    opdivsLoaded: true,
    fismaSystems: [],
    fismaSystemsLoaded: true,
    userInfo: admin,
  }
})

const renderAt = (entry: string | { pathname: string; state: unknown }) =>
  renderWithProviders(
    <Routes>
      <Route path="/opdivs" element={<OpDivIndexRedirect />} />
      <Route path="/opdivs/:id" element={<Landed />} />
    </Routes>,
    { initialEntries: [entry] }
  )

describe('OpDivIndexRedirect', () => {
  it('skips an OpDiv just deactivated while the list is still stale', () => {
    // One OpDiv left after the skip: lands on it, not back on the deactivated.
    window.sessionStorage.setItem('ztmf.lastOpDivId', '7')
    const { container } = renderAt({
      pathname: '/opdivs',
      state: { skipOpDivId: 7 },
    })
    expect(container).toHaveTextContent('landed on 9')
  })

  it('reports a failed /opdivs instead of "no OpDiv assignments"', () => {
    mockContext = { ...mockContext, opdivs: [], opdivsError: true }
    renderAt('/opdivs')
    expect(screen.getByText('Could not load OpDivs')).toBeInTheDocument()
    expect(screen.queryByText('No OpDivs available')).not.toBeInTheDocument()
  })
})
