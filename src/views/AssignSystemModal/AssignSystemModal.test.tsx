// Coverage for the Assign Systems modal. Globals (allSystems +
// decommSystems) are fetched by the parent UserTable and passed down as
// props, so the modal itself only fires the two per-user reads on open:
//   - GET /users/:id/assignedfismasystems (current assignments)
//   - GET /users/:id/assignablefismasystems (server-scoped picker options)
// Tests verify:
//   - both per-user reads fire on open,
//   - the dropdown offers exactly what the assignable endpoint returns,
//   - decommissioned entries in the passed-in metadata chip with a
//     "(Decommissioned)" suffix and subdued styling,
//   - cross-scope orphan assignments chip labeled from the passed-in
//     global list so an admin can still unassign them,
//   - a failing assignable read degrades gracefully to an empty dropdown,
//   - reopening for a different user clears the previous chips, but
//     reopening for the same user keeps them visible while the fresh
//     reads run underneath,
//   - assign / unassign round-trip to the right endpoints, with unassign
//     gated behind the confirm dialog, and
//   - an id absent from every metadata source still chips identifiably.

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

import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import axiosInstance from '@/axiosConfig'
import AssignSystemModal from './AssignSystemModal'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import type { FismaSystemType } from '@/types'

const mock = new MockAdapter(axiosInstance)

const USER_ID = '22222222-2222-2222-2222-222222222222'

// Minimal FismaSystemType-shaped rows. Only the fields the modal reads
// (fismasystemid, fismaacronym, fismaname, fismasubsystem) are meaningful.
const DS1: FismaSystemType = {
  fismasystemid: 1001,
  fismaacronym: 'DS-1',
  fismaname: 'Death Star',
  fismasubsystem: null,
} as unknown as FismaSystemType

const CHI: FismaSystemType = {
  fismasystemid: 1101,
  fismaacronym: 'ISD-CHI',
  fismaname: 'Star Destroyer Chimaera',
  fismasubsystem: null,
} as unknown as FismaSystemType

const EXECUTOR: FismaSystemType = {
  fismasystemid: 1002,
  fismaacronym: 'SSD-EX',
  fismaname: 'Super Star Destroyer Executor',
  fismasubsystem: 'Flagship Communication Hub',
} as unknown as FismaSystemType

function renderModal(
  overrides: Partial<React.ComponentProps<typeof AssignSystemModal>> = {}
) {
  return renderWithProviders(
    <AssignSystemModal
      open={true}
      handleClose={() => {}}
      userid={USER_ID}
      userName="Admiral Piett"
      allSystems={[]}
      decommSystems={[]}
      {...overrides}
    />
  )
}

beforeEach(() => {
  mock.reset()
})

test('fires the two per-user reads on open', async () => {
  mock.onGet(`/users/${USER_ID}/assignedfismasystems`).reply(200, { data: [] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [] })

  renderModal()

  await waitFor(() =>
    expect(
      mock.history.get.some((r) =>
        (r.url ?? '').endsWith(`/users/${USER_ID}/assignedfismasystems`)
      )
    ).toBe(true)
  )
  expect(
    mock.history.get.some((r) =>
      (r.url ?? '').endsWith(`/users/${USER_ID}/assignablefismasystems`)
    )
  ).toBe(true)
  // Globals come from props now - modal must NOT fire them.
  expect(
    mock.history.get.some((r) => (r.url ?? '').endsWith('/fismasystems'))
  ).toBe(false)
  expect(
    mock.history.get.some((r) =>
      (r.url ?? '').endsWith('/fismasystems?decommissioned=true')
    )
  ).toBe(false)
})

test('assigned system flagged decommissioned via props chips with "(Decommissioned)" suffix and subdued styling', async () => {
  const retiredExecutor: FismaSystemType = {
    ...EXECUTOR,
    decommissioned: true,
  } as unknown as FismaSystemType
  mock
    .onGet(`/users/${USER_ID}/assignedfismasystems`)
    .reply(200, { data: [1002] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [DS1] })

  renderModal({
    allSystems: [DS1],
    decommSystems: [retiredExecutor],
  })

  await waitFor(() =>
    expect(document.body.querySelectorAll('.MuiChip-root').length).toBe(1)
  )
  const chip = document.body.querySelector('.MuiChip-root') as HTMLElement
  expect(chip.textContent).toMatch(
    /SSD-EX\s*-\s*Super Star Destroyer Executor\s*-\s*Flagship Communication Hub\s*\(Decommissioned\)/i
  )
  const chipStyle = window.getComputedStyle(chip)
  expect(parseFloat(chipStyle.opacity)).toBeLessThan(1)
  expect(chipStyle.fontStyle).toBe('italic')
})

test('dropdown offers exactly the systems the assignable endpoint returns', async () => {
  const user = userEvent.setup()
  mock.onGet(`/users/${USER_ID}/assignedfismasystems`).reply(200, { data: [] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [DS1, CHI] })

  renderModal()

  const combobox = await screen.findByRole('combobox', {
    name: /assign fisma systems/i,
  })
  await user.click(combobox)

  await waitFor(() =>
    expect(screen.getByText(/DS-1\s*-\s*Death Star/i)).toBeInTheDocument()
  )
  expect(
    screen.getByText(/ISD-CHI\s*-\s*Star Destroyer Chimaera/i)
  ).toBeInTheDocument()
})

test('typing an acronym filters the dropdown to the matching system', async () => {
  // The picker must match on the acronym, not just the system name: typing
  // "ISD" surfaces ISD-CHI and drops DS-1 / Death Star.
  const user = userEvent.setup()
  mock.onGet(`/users/${USER_ID}/assignedfismasystems`).reply(200, { data: [] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [DS1, CHI] })

  renderModal()

  const combobox = await screen.findByRole('combobox', {
    name: /assign fisma systems/i,
  })
  await user.click(combobox)
  await waitFor(() =>
    expect(screen.getByText(/DS-1\s*-\s*Death Star/i)).toBeInTheDocument()
  )

  await user.type(combobox, 'ISD')

  await waitFor(() =>
    expect(
      screen.getByText(/ISD-CHI\s*-\s*Star Destroyer Chimaera/i)
    ).toBeInTheDocument()
  )
  expect(screen.queryByText(/Death Star/i)).not.toBeInTheDocument()
})

test('acronym matching is case-insensitive', async () => {
  const user = userEvent.setup()
  mock.onGet(`/users/${USER_ID}/assignedfismasystems`).reply(200, { data: [] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [DS1, CHI] })

  renderModal()

  const combobox = await screen.findByRole('combobox', {
    name: /assign fisma systems/i,
  })
  await user.click(combobox)
  await waitFor(() => expect(screen.getByText(/DS-1/)).toBeInTheDocument())

  await user.type(combobox, 'isd')

  await waitFor(() =>
    expect(
      screen.getByText(/ISD-CHI\s*-\s*Star Destroyer Chimaera/i)
    ).toBeInTheDocument()
  )
  expect(screen.queryByText(/Death Star/i)).not.toBeInTheDocument()
})

test('typing a system name filters the dropdown to the matching system', async () => {
  const user = userEvent.setup()
  mock.onGet(`/users/${USER_ID}/assignedfismasystems`).reply(200, { data: [] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [DS1, CHI] })

  renderModal()

  const combobox = await screen.findByRole('combobox', {
    name: /assign fisma systems/i,
  })
  await user.click(combobox)
  await waitFor(() => expect(screen.getByText(/ISD-CHI/)).toBeInTheDocument())

  await user.type(combobox, 'Death')

  await waitFor(() =>
    expect(screen.getByText(/DS-1\s*-\s*Death Star/i)).toBeInTheDocument()
  )
  expect(screen.queryByText(/ISD-CHI/)).not.toBeInTheDocument()
})

test('assignable subsystem name is appended to the label', async () => {
  const user = userEvent.setup()
  mock.onGet(`/users/${USER_ID}/assignedfismasystems`).reply(200, { data: [] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [EXECUTOR] })

  renderModal()

  const combobox = await screen.findByRole('combobox', {
    name: /assign fisma systems/i,
  })
  await user.click(combobox)

  await waitFor(() =>
    expect(
      screen.getByText(
        /SSD-EX\s*-\s*Super Star Destroyer Executor\s*-\s*Flagship Communication Hub/i
      )
    ).toBeInTheDocument()
  )
})

test('an out-of-scope orphan assignment chips with a LABEL from the allSystems prop', async () => {
  // Piett is currently assigned to Executor (1002). The server excludes
  // Executor from his per-user assignable set (its OpDiv is no longer in
  // his scope), but the parent-supplied allSystems prop still carries it
  // as an active system. The chip must render labeled - the admin needs
  // to see WHICH system they are unassigning - even though the DROPDOWN
  // must not offer it as a re-selection target.
  const user = userEvent.setup()
  mock
    .onGet(`/users/${USER_ID}/assignedfismasystems`)
    .reply(200, { data: [1002] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [DS1] })

  renderModal({ allSystems: [DS1, EXECUTOR] })

  await waitFor(() =>
    expect(document.body.querySelectorAll('.MuiChip-root').length).toBe(1)
  )
  const chip = document.body.querySelector('.MuiChip-root') as HTMLElement
  expect(chip.textContent).toMatch(
    /SSD-EX\s*-\s*Super Star Destroyer Executor/i
  )

  const combobox = screen.getByRole('combobox', {
    name: /assign fisma systems/i,
  })
  await user.click(combobox)
  await waitFor(() =>
    expect(screen.getByText(/DS-1\s*-\s*Death Star/i)).toBeInTheDocument()
  )
  const listbox = document.body.querySelector('.MuiAutocomplete-listbox')
  expect(listbox?.textContent ?? '').not.toMatch(/SSD-EX/)
})

test('empty assignable response shows no dropdown options; existing chips still render', async () => {
  const user = userEvent.setup()
  mock
    .onGet(`/users/${USER_ID}/assignedfismasystems`)
    .reply(200, { data: [1001] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [] })

  renderModal({ allSystems: [DS1] })

  await waitFor(() =>
    expect(document.body.querySelectorAll('.MuiChip-root').length).toBe(1)
  )

  const combobox = screen.getByRole('combobox', {
    name: /assign fisma systems/i,
  })
  await user.click(combobox)
  await waitFor(() =>
    expect(screen.getByText(/No options/i)).toBeInTheDocument()
  )
})

test('an assignable-endpoint failure degrades gracefully to empty options', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  const user = userEvent.setup()
  mock
    .onGet(`/users/${USER_ID}/assignedfismasystems`)
    .reply(200, { data: [1001] })
  mock.onGet(`/users/${USER_ID}/assignablefismasystems`).reply(500)

  renderModal({ allSystems: [DS1] })

  await waitFor(() =>
    expect(document.body.querySelectorAll('.MuiChip-root').length).toBe(1)
  )

  const combobox = screen.getByRole('combobox', {
    name: /assign fisma systems/i,
  })
  await user.click(combobox)
  await waitFor(() =>
    expect(screen.getByText(/No options/i)).toBeInTheDocument()
  )
  ;(console.error as jest.Mock).mockRestore?.()
})

test('assigned system present in the assignable set renders a labeled chip', async () => {
  mock
    .onGet(`/users/${USER_ID}/assignedfismasystems`)
    .reply(200, { data: [1002] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [EXECUTOR] })

  renderModal()

  await waitFor(() =>
    expect(document.body.querySelectorAll('.MuiChip-root').length).toBe(1)
  )
  const chip = document.body.querySelector('.MuiChip-root') as HTMLElement
  expect(chip.textContent).toMatch(
    /SSD-EX\s*-\s*Super Star Destroyer Executor/i
  )
})

test('an id absent from every metadata source still chips identifiably', async () => {
  // Defense in depth for the blank-chip failure mode. The parent's global
  // reads are allSettled, so a failure there leaves an out-of-scope orphan
  // with no label source at all. The chip must still say something an
  // admin can act on - a blank chip gives no way to tell what is being
  // unassigned.
  mock
    .onGet(`/users/${USER_ID}/assignedfismasystems`)
    .reply(200, { data: [9999] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [DS1] })

  renderModal({ allSystems: [], decommSystems: [] })

  await waitFor(() =>
    expect(document.body.querySelectorAll('.MuiChip-root').length).toBe(1)
  )
  const label = document.body.querySelector(
    '.MuiChip-label'
  ) as HTMLElement | null
  expect(label).not.toBeNull()
  expect(label!.textContent).toMatch(
    /Unknown or decommissioned system \(id 9999\)/
  )
})

test('an already-assigned system shows in the dropdown as checked and disabled', async () => {
  // Guards against double-assigning: the row stays visible (so the admin
  // can see it is already granted) but cannot be re-selected. Removal goes
  // through the chip, not the dropdown row.
  const user = userEvent.setup()
  mock
    .onGet(`/users/${USER_ID}/assignedfismasystems`)
    .reply(200, { data: [1001] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [DS1, CHI] })

  renderModal()

  const combobox = await screen.findByRole('combobox', {
    name: /assign fisma systems/i,
  })
  await user.click(combobox)

  // DS-1 is both a chip and a dropdown row here, so scope the lookup to
  // the listbox rather than matching on text across the whole dialog.
  await waitFor(() =>
    expect(
      document.body.querySelectorAll('.MuiAutocomplete-listbox li').length
    ).toBe(2)
  )
  const rows = Array.from(
    document.body.querySelectorAll('.MuiAutocomplete-listbox li')
  )
  const checkboxFor = (pattern: RegExp) => {
    const li = rows.find((r) => pattern.test(r.textContent ?? ''))
    expect(li).toBeDefined()
    return li!.querySelector('input[type="checkbox"]') as HTMLInputElement
  }

  const assignedCheckbox = checkboxFor(/DS-1/)
  expect(assignedCheckbox.checked).toBe(true)
  expect(assignedCheckbox.disabled).toBe(true)

  // An unassigned option in the same list stays selectable.
  const freeCheckbox = checkboxFor(/ISD-CHI/)
  expect(freeCheckbox.checked).toBe(false)
  expect(freeCheckbox.disabled).toBe(false)
})

test('selecting an option POSTs the assignment and chips it', async () => {
  const user = userEvent.setup()
  mock.onGet(`/users/${USER_ID}/assignedfismasystems`).reply(200, { data: [] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [DS1] })
  mock.onPost(`/users/${USER_ID}/assignedfismasystems`).reply(200, {})

  renderModal()

  const combobox = await screen.findByRole('combobox', {
    name: /assign fisma systems/i,
  })
  await user.click(combobox)
  await user.click(await screen.findByText(/DS-1\s*-\s*Death Star/i))

  await waitFor(() => expect(mock.history.post.length).toBe(1))
  expect(JSON.parse(mock.history.post[0].data)).toEqual({
    fismasystemid: 1001,
  })
  await waitFor(() =>
    expect(document.body.querySelectorAll('.MuiChip-root').length).toBe(1)
  )
})

test('a failed assign POST leaves the chip off rather than showing a false success', async () => {
  // The optimistic value is only committed after the POST resolves, so a
  // rejected write must not leave a chip implying the grant landed.
  const user = userEvent.setup()
  mock.onGet(`/users/${USER_ID}/assignedfismasystems`).reply(200, { data: [] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [DS1] })
  mock.onPost(`/users/${USER_ID}/assignedfismasystems`).reply(500)

  renderModal()

  const combobox = await screen.findByRole('combobox', {
    name: /assign fisma systems/i,
  })
  await user.click(combobox)
  await user.click(await screen.findByText(/DS-1\s*-\s*Death Star/i))

  await waitFor(() => expect(mock.history.post.length).toBe(1))
  expect(document.body.querySelectorAll('.MuiChip-root').length).toBe(0)
})

test('removing a chip asks for confirmation and DELETEs only on confirm', async () => {
  const user = userEvent.setup()
  mock
    .onGet(`/users/${USER_ID}/assignedfismasystems`)
    .reply(200, { data: [1001] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [DS1] })
  mock.onDelete(`/users/${USER_ID}/assignedfismasystems/1001`).reply(200, {})

  renderModal()

  await waitFor(() =>
    expect(document.body.querySelectorAll('.MuiChip-root').length).toBe(1)
  )
  await user.click(
    document.body.querySelector('.MuiChip-deleteIcon') as HTMLElement
  )

  // Confirm dialog names the system and the user so the admin can see
  // exactly what they are about to revoke.
  const prompt = await screen.findByText(
    /unassign DS-1\s*-\s*Death Star from Admiral Piett/i
  )
  expect(prompt).toBeInTheDocument()
  // Nothing is written until the admin confirms.
  expect(mock.history.delete.length).toBe(0)

  await user.click(screen.getByRole('button', { name: /^confirm$/i }))

  await waitFor(() => expect(mock.history.delete.length).toBe(1))
  await waitFor(() =>
    expect(document.body.querySelectorAll('.MuiChip-root').length).toBe(0)
  )
})

test('cancelling the unassign prompt keeps the chip and writes nothing', async () => {
  const user = userEvent.setup()
  mock
    .onGet(`/users/${USER_ID}/assignedfismasystems`)
    .reply(200, { data: [1001] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [DS1] })
  mock.onDelete(`/users/${USER_ID}/assignedfismasystems/1001`).reply(200, {})

  renderModal()

  await waitFor(() =>
    expect(document.body.querySelectorAll('.MuiChip-root').length).toBe(1)
  )
  await user.click(
    document.body.querySelector('.MuiChip-deleteIcon') as HTMLElement
  )
  await screen.findByText(/unassign DS-1/i)
  await user.click(screen.getByRole('button', { name: /^cancel$/i }))

  expect(mock.history.delete.length).toBe(0)
  expect(document.body.querySelectorAll('.MuiChip-root').length).toBe(1)
})

test('a decommissioned assignment is still removable', async () => {
  // The subdued styling marks it as historical, but an admin must still be
  // able to revoke it - that is the whole point of keeping the chip
  // rendered rather than dropping unknown-to-assignable ids.
  const user = userEvent.setup()
  const retiredExecutor: FismaSystemType = {
    ...EXECUTOR,
    decommissioned: true,
  } as unknown as FismaSystemType
  mock
    .onGet(`/users/${USER_ID}/assignedfismasystems`)
    .reply(200, { data: [1002] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [DS1] })
  mock.onDelete(`/users/${USER_ID}/assignedfismasystems/1002`).reply(200, {})

  renderModal({ allSystems: [DS1], decommSystems: [retiredExecutor] })

  await waitFor(() =>
    expect(document.body.querySelectorAll('.MuiChip-root').length).toBe(1)
  )
  const deleteIcon = document.body.querySelector('.MuiChip-deleteIcon')
  expect(deleteIcon).not.toBeNull()

  await user.click(deleteIcon as HTMLElement)
  await screen.findByText(/unassign SSD-EX/i)
  await user.click(screen.getByRole('button', { name: /^confirm$/i }))

  await waitFor(() => expect(mock.history.delete.length).toBe(1))
})

test('a failing assigned read still leaves the dropdown usable', async () => {
  // Inverse of the assignable-failure case: the chip source is gone but
  // the picker options survive, so the admin can still grant access.
  jest.spyOn(console, 'error').mockImplementation(() => {})
  const user = userEvent.setup()
  mock.onGet(`/users/${USER_ID}/assignedfismasystems`).reply(500)
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [DS1, CHI] })

  renderModal()

  const combobox = await screen.findByRole('combobox', {
    name: /assign fisma systems/i,
  })
  await user.click(combobox)

  await waitFor(() =>
    expect(screen.getByText(/DS-1\s*-\s*Death Star/i)).toBeInTheDocument()
  )
  expect(document.body.querySelectorAll('.MuiChip-root').length).toBe(0)
  ;(console.error as jest.Mock).mockRestore?.()
})

test('dropdown options are ordered by acronym regardless of response order', async () => {
  const user = userEvent.setup()
  mock.onGet(`/users/${USER_ID}/assignedfismasystems`).reply(200, { data: [] })
  // Deliberately reverse-sorted on the wire.
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [EXECUTOR, CHI, DS1] })

  renderModal()

  const combobox = await screen.findByRole('combobox', {
    name: /assign fisma systems/i,
  })
  await user.click(combobox)

  await waitFor(() =>
    expect(screen.getByText(/DS-1\s*-\s*Death Star/i)).toBeInTheDocument()
  )
  const rows = Array.from(
    document.body.querySelectorAll('.MuiAutocomplete-listbox li')
  ).map((li) => (li.textContent ?? '').trim())
  expect(rows).toHaveLength(3)
  // DS-1 < ISD-CHI < SSD-EX
  expect(rows[0]).toMatch(/^DS-1/)
  expect(rows[1]).toMatch(/^ISD-CHI/)
  expect(rows[2]).toMatch(/^SSD-EX/)
})

test('reopening for a different user clears the previous chips before new fetches resolve', async () => {
  // User A resolves with an assignment; user B's fetches are held so we
  // can observe the intermediate state. The stateOwnerRef check clears
  // chips when the userid changes - otherwise user A's chip would linger
  // until user B's response arrived.
  const OTHER_USER_ID = '33333333-3333-3333-3333-333333333333'
  mock
    .onGet(`/users/${USER_ID}/assignedfismasystems`)
    .reply(200, { data: [1002] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [EXECUTOR] })
  let releaseB: () => void = () => {}
  const bPending = new Promise<void>((resolve) => {
    releaseB = resolve
  })
  mock
    .onGet(`/users/${OTHER_USER_ID}/assignedfismasystems`)
    .reply(() => bPending.then(() => [200, { data: [] }]))
  mock
    .onGet(`/users/${OTHER_USER_ID}/assignablefismasystems`)
    .reply(() => bPending.then(() => [200, { data: [] }]))

  const utils = renderModal()

  await waitFor(() =>
    expect(document.body.querySelectorAll('.MuiChip-root').length).toBe(1)
  )

  utils.rerender(
    <AssignSystemModal
      open={true}
      handleClose={() => {}}
      userid={OTHER_USER_ID}
      userName="Some Other User"
      allSystems={[]}
      decommSystems={[]}
    />
  )
  await waitFor(() =>
    expect(document.body.querySelectorAll('.MuiChip-root').length).toBe(0)
  )

  releaseB()
})

test('reopening for the SAME user keeps chips visible while fresh fetches run', async () => {
  // Same-user reopen: the modal must NOT blank the chip area while the
  // refresh reads are in flight. Contrast with the different-user test
  // above - that path clears; this path preserves. Perceived latency
  // matters most here: an admin who opens the picker, closes it, and
  // reopens should see chips instantly.
  mock
    .onGet(`/users/${USER_ID}/assignedfismasystems`)
    .reply(200, { data: [1002] })
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(200, { data: [EXECUTOR] })

  const utils = renderModal()

  await waitFor(() =>
    expect(document.body.querySelectorAll('.MuiChip-root').length).toBe(1)
  )
  // Flush the second state setter (setAssignable) from the initial
  // Promise.allSettled so the rerender below doesn't race a lingering
  // update outside act(). The waitFor above only confirms one of the two.
  await act(async () => {
    await Promise.resolve()
  })

  // Close and hold the reopen fetches so we can observe the moment
  // just after `open` flips true again.
  let releaseReopen: () => void = () => {}
  const reopenPending = new Promise<void>((resolve) => {
    releaseReopen = resolve
  })
  mock.reset()
  mock
    .onGet(`/users/${USER_ID}/assignedfismasystems`)
    .reply(() => reopenPending.then(() => [200, { data: [1002] }]))
  mock
    .onGet(`/users/${USER_ID}/assignablefismasystems`)
    .reply(() => reopenPending.then(() => [200, { data: [EXECUTOR] }]))

  await act(async () => {
    utils.rerender(
      <AssignSystemModal
        open={false}
        handleClose={() => {}}
        userid={USER_ID}
        userName="Admiral Piett"
        allSystems={[]}
        decommSystems={[]}
      />
    )
    utils.rerender(
      <AssignSystemModal
        open={true}
        handleClose={() => {}}
        userid={USER_ID}
        userName="Admiral Piett"
        allSystems={[]}
        decommSystems={[]}
      />
    )
  })

  // Chip stays visible during the in-flight refresh - no empty flash.
  expect(document.body.querySelectorAll('.MuiChip-root').length).toBe(1)
  releaseReopen()
})
