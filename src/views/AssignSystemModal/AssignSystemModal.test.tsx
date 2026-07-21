// Picker-side coverage for the Assign Systems modal. The parent
// UserTable builds fismaSystemMap from both /fismasystems and
// /fismasystems?decommissioned=true (see UserTable.test.tsx). This file
// verifies that the picker
//   - surfaces active entries as options,
//   - keeps decommissioned entries in the value pool so their assignments
//     render as labeled chips (with a "(Decommissioned)" suffix and a
//     subdued visual), and
//   - filters those decommissioned entries out of the selectable dropdown.

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
  1001: { acronym: 'DS-1', name: 'Death Star', decommissioned: false },
  1101: {
    acronym: 'ISD-CHI',
    name: 'Star Destroyer Chimaera',
    decommissioned: false,
  },
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

test('decommissioned entries in the map are hidden from the selectable dropdown', async () => {
  // The map carries decommissioned entries so their existing assignments
  // can render as labeled chips (see the "(Decommissioned)" chip test
  // below). They must NOT appear in the dropdown as new options - an
  // admin cannot assign a user to a decommissioned system. filterOptions
  // strips them; this test locks it in.
  const user = userEvent.setup()
  mock.onGet(`/users/${USER_ID}/assignedfismasystems`).reply(200, { data: [] })

  renderModal({
    fismaSystemMap: {
      ...ACTIVE_MAP,
      9001: {
        acronym: 'DECOM-A',
        name: 'Decommissioned System A',
        decommissioned: true,
      },
    },
  })

  const combobox = await screen.findByRole('combobox', {
    name: /assign fisma systems/i,
  })
  await user.click(combobox)

  await waitFor(() => expect(screen.getByText(/DS-1/)).toBeInTheDocument())
  // Active entries render as options, but DECOM-A does not.
  expect(screen.getByText(/ISD-CHI/)).toBeInTheDocument()
  expect(screen.queryByText(/DECOM-A/)).not.toBeInTheDocument()
})

test('assigned system present as an active map entry renders a plain labeled chip', async () => {
  const executor = {
    acronym: 'SSD-EX',
    name: 'Super Star Destroyer Executor',
    decommissioned: false,
  }
  mock
    .onGet(`/users/${USER_ID}/assignedfismasystems`)
    .reply(200, { data: [1002] })

  renderModal({
    fismaSystemMap: { ...ACTIVE_MAP, 1002: executor },
  })

  // Dialog renders through a portal, so query document.body.
  await waitFor(() =>
    expect(document.body.querySelectorAll('.MuiChip-root').length).toBe(1)
  )
  const chip = document.body.querySelector('.MuiChip-root') as HTMLElement
  expect(chip.textContent).toMatch(
    /SSD-EX\s*-\s*Super Star Destroyer Executor/i
  )
  expect(chip.textContent).not.toMatch(/Decommissioned/i)
})

test('assignment to a decommissioned system renders a labeled chip with "(Decommissioned)" suffix', async () => {
  // A user assigned to a system that was later decommissioned still has
  // that id in /users/:id/assignedfismasystems. The chip picks up the
  // decommissioned flag from the map and renders
  // "SSD-EX - Super Star Destroyer Executor (Decommissioned)" with a
  // subdued visual (opacity 0.65 + italic).
  const retiredExecutor = {
    acronym: 'SSD-EX',
    name: 'Super Star Destroyer Executor',
    decommissioned: true,
  }
  mock
    .onGet(`/users/${USER_ID}/assignedfismasystems`)
    .reply(200, { data: [1002] })

  renderModal({
    fismaSystemMap: { ...ACTIVE_MAP, 1002: retiredExecutor },
  })

  await waitFor(() =>
    expect(document.body.querySelectorAll('.MuiChip-root').length).toBe(1)
  )
  const chip = document.body.querySelector('.MuiChip-root') as HTMLElement
  const label = chip.querySelector('.MuiChip-label') as HTMLElement | null
  expect(label).not.toBeNull()
  // Full readable label with the "(Decommissioned)" suffix.
  expect(label!.textContent).toMatch(
    /SSD-EX\s*-\s*Super Star Destroyer Executor\s*\(Decommissioned\)/i
  )
  // Subdued visual: opacity < 1 and italic.
  const chipStyle = window.getComputedStyle(chip)
  expect(parseFloat(chipStyle.opacity)).toBeLessThan(1)
  expect(chipStyle.fontStyle).toBe('italic')
})

test('assigned id absent from the map entirely still renders an identifiable fallback chip', async () => {
  // Defense-in-depth: if for any reason the map lacks the id (race
  // between fetch and render, or a system removed between assignment
  // and load), the chip still gets a readable id-based label so the
  // admin can unassign it.
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mock
    .onGet(`/users/${USER_ID}/assignedfismasystems`)
    .reply(200, { data: [9999] })

  renderModal({ fismaSystemMap: ACTIVE_MAP }) // 9999 is deliberately absent

  await waitFor(() =>
    expect(document.body.querySelectorAll('.MuiChip-root').length).toBe(1)
  )
  const chip = document.body.querySelector('.MuiChip-root') as HTMLElement
  const label = chip.querySelector('.MuiChip-label') as HTMLElement | null
  expect(label).not.toBeNull()
  expect(label!.textContent).toMatch(
    /Unknown or decommissioned system \(id 9999\)/
  )
  ;(console.error as jest.Mock).mockRestore?.()
})
