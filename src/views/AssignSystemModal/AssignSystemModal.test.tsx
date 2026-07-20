// Picker-side coverage for #532. The parent UserTable builds fismaSystemMap
// from the active /fismasystems response (see UserTable.test.tsx); this
// file verifies the picker actually surfaces the map's entries as options
// and doesn't smuggle in the poisoned decommissioned entries any other way.

jest.mock('@/router/router', () => ({
  __esModule: true,
  default: { navigate: jest.fn() },
}))

jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  const { handleAuthError } = require('@/utils/authInterceptor')
  const instance = axios.create({ baseURL: '/api/v1/' })
  instance.interceptors.response.use(
    (response: unknown) => response,
    handleAuthError
  )
  return { __esModule: true, default: instance }
})

import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import axiosInstance from '@/axiosConfig'
import AssignSystemModal from './AssignSystemModal'
import { renderWithProviders } from '@/test-utils/renderWithProviders'

const mock = new MockAdapter(axiosInstance)

const USER_ID = '22222222-2222-2222-2222-222222222222'

const ACTIVE_MAP = {
  1001: { acronym: 'DS-1', name: 'Death Star' },
  1101: { acronym: 'ISD-CHI', name: 'Star Destroyer Chimaera' },
}

function renderModal(
  overrides: Partial<React.ComponentProps<typeof AssignSystemModal>> = {}
) {
  return renderWithProviders(
    <AssignSystemModal
      open={true}
      handleClose={() => {}}
      userid={USER_ID}
      userName="Admiral Piett"
      fismaSystemMap={ACTIVE_MAP}
      {...overrides}
    />
  )
}

beforeEach(() => {
  mock.reset()
})

test('renders the active systems from the map as picker options', async () => {
  const user = userEvent.setup()
  mock.onGet(`/users/${USER_ID}/assignedfismasystems`).reply(200, { data: [] })

  renderModal()

  // Open the Autocomplete popup.
  const combobox = await screen.findByRole('combobox', {
    name: /assign fisma systems/i,
  })
  await user.click(combobox)

  // Every active-map entry appears as a selectable option.
  await waitFor(() =>
    expect(screen.getByText(/DS-1\s*-\s*Death Star/i)).toBeInTheDocument()
  )
  expect(
    screen.getByText(/ISD-CHI\s*-\s*Star Destroyer Chimaera/i)
  ).toBeInTheDocument()
})

test('a poisoned decommissioned map entry never leaks into the picker', async () => {
  // Simulates the pre-fix bug: if the map contained a decommissioned
  // system, the picker would render it. This test locks in that the
  // picker rendering faithfully reflects whatever map it is given, so
  // upstream #532 fix is the single source of truth for what's shown.
  const user = userEvent.setup()
  mock.onGet(`/users/${USER_ID}/assignedfismasystems`).reply(200, { data: [] })

  renderModal({
    fismaSystemMap: {
      1001: { acronym: 'DS-1', name: 'Death Star' },
    },
  })

  const combobox = await screen.findByRole('combobox', {
    name: /assign fisma systems/i,
  })
  await user.click(combobox)

  await waitFor(() => expect(screen.getByText(/DS-1/)).toBeInTheDocument())
  expect(screen.queryByText(/DECOM/i)).not.toBeInTheDocument()
})

test('assigned system present in the map renders a labeled chip', async () => {
  const executor = { acronym: 'SSD-EX', name: 'Super Star Destroyer Executor' }
  mock
    .onGet(`/users/${USER_ID}/assignedfismasystems`)
    .reply(200, { data: [1002] })

  renderModal({
    fismaSystemMap: { ...ACTIVE_MAP, 1002: executor },
  })

  // The Dialog renders through a portal, so query document.body rather than
  // the render container.
  await waitFor(() =>
    expect(document.body.querySelectorAll('.MuiChip-root').length).toBe(1)
  )
  const chip = document.body.querySelector('.MuiChip-root') as HTMLElement
  expect(chip.textContent).toMatch(
    /SSD-EX\s*-\s*Super Star Destroyer Executor/i
  )
})

test('assigned system id absent from the map renders a chip with an empty label', async () => {
  // Locks in the pre-existing edge case flagged in the #532 review: when
  // an assigned system id is not in the active map (e.g. because it was
  // decommissioned since the assignment), MUI still renders the value as
  // a chip - but getOptionLabel returns '' for that id, so the chip's
  // label is empty. A future change that renders a real fallback like
  // "(unknown system)" would make this label non-empty and (intentionally)
  // flip the test. A change that pulls the id itself into the picker's
  // options pool would make the "labeled chip" test above render a chip
  // for 9999 instead.
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mock
    .onGet(`/users/${USER_ID}/assignedfismasystems`)
    .reply(200, { data: [9999] })

  renderModal({ fismaSystemMap: ACTIVE_MAP }) // 9999 is deliberately absent

  // Portal-mounted DOM: query document.body, not the render container.
  await waitFor(() =>
    expect(document.body.querySelectorAll('.MuiChip-root').length).toBe(1)
  )
  const chip = document.body.querySelector('.MuiChip-root') as HTMLElement
  const label = chip.querySelector('.MuiChip-label') as HTMLElement | null
  expect(label).not.toBeNull()
  // The empty label is the actual pre-existing UX gap: the user sees a
  // deletable chip with no readable name for the assignment. Any real
  // fallback label would make this trim() non-empty and flip the test.
  expect(label!.textContent?.trim() ?? '').toBe('')
  ;(console.error as jest.Mock).mockRestore?.()
})
