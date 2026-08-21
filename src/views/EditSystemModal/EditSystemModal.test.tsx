// Coverage for the Add/Edit modal's extended-metadata clearing. The key
// regression: picking "None" on an enum select must persist as an empty string
// (the backend's blankToNil clears on '' and treats null as "leave unchanged"),
// and the save must send a dirty-diff of only the changed field.

// axiosConfig reads import.meta.env at module load and throws under @swc/jest.
// Swap in a bare axios instance the MockAdapter can drive.
jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: '/api/v1/' }) }
})
jest.mock('@/utils/notify', () => {
  const actual = jest.requireActual('@/utils/notify')
  return { ...actual, notify: jest.fn() }
})

import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import EditSystemModal from './EditSystemModal'
import { EMPTY_SYSTEM } from './emptySystem'
import axiosInstance from '@/axiosConfig'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import type { FismaSystemType, OpDiv } from '@/types'

const mock = new MockAdapter(axiosInstance)
afterEach(() => mock.reset())
// Arrives as a prop from Title, so the dropdown needs no request mock.
const OPDIVS: OpDiv[] = [
  {
    opdiv_id: 1,
    code: 'CMS',
    name: 'CMS',
    is_parent: false,
    active: true,
    system_delegate_enabled: false,
    insights_enabled: false,
  },
]

const SYSTEM = {
  fismasystemid: 42,
  fismaname: 'Executor',
  fismaacronym: 'EXEC',
  fismauid: 'UID-42',
  component: 'CMS',
  datacenterenvironment: 'CMS-Cloud-AWS',
  issoemail: 'admiral.piett@executor.empire',
  datacallcontact: 'captain.needa@executor.empire',
  opdiv_id: 1,
  sdl_sync_enabled: false,
  fips: 'Low',
  hva: null,
  cloud_system: null,
  cloud_service_model: null,
  cloud_vendor: null,
  system_operator: null,
  goco_coco_gogo: null,
  system_owner: null,
  system_owner_email: null,
  legacy: null,
} as unknown as FismaSystemType

test('clearing an enum select to None saves an empty string, not null', async () => {
  mock.onGet('/systemattributes').reply(200, {
    data: [
      {
        field: 'fips',
        value: 'Low',
        selectable: true,
        ordr: 10,
      },
      {
        field: 'fips',
        value: 'High',
        selectable: true,
        ordr: 20,
      },
    ],
  })
  let putBody: Record<string, unknown> | undefined
  mock.onPut(/fismasystems\/42$/).reply((config) => {
    putBody = JSON.parse(config.data)
    return [200, {}]
  })
  const user = userEvent.setup()

  renderWithProviders(
    <EditSystemModal
      title="Edit"
      open
      onClose={jest.fn()}
      system={SYSTEM}
      mode="edit"
      datacenterEnvironments={[]}
      opdivs={OPDIVS}
    />
  )

  // Clear FIPS: open the select and choose the None option.
  await user.click(
    await screen.findByRole('combobox', { name: 'FIPS Impact Level' })
  )
  await user.click(await screen.findByRole('option', { name: /None/ }))

  await user.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(putBody).toBeDefined())
  // Empty string is the clear signal; null would read as "leave unchanged".
  expect(putBody).toHaveProperty('fips', '')
})

test('an untouched extended field is omitted from the save (dirty-diff)', async () => {
  mock.onGet('/systemattributes').reply(200, {
    data: [
      {
        field: 'fips',
        value: 'Low',
        selectable: true,
        ordr: 10,
      },
    ],
  })
  let putBody: Record<string, unknown> | undefined
  mock.onPut(/fismasystems\/42$/).reply((config) => {
    putBody = JSON.parse(config.data)
    return [200, {}]
  })
  const user = userEvent.setup()

  renderWithProviders(
    <EditSystemModal
      title="Edit"
      open
      onClose={jest.fn()}
      system={SYSTEM}
      mode="edit"
      datacenterEnvironments={[]}
      opdivs={OPDIVS}
    />
  )

  await screen.findByRole('combobox', { name: 'FIPS Impact Level' })
  await user.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(putBody).toBeDefined())
  // Nothing was changed, so no extended field should be in the payload.
  expect(putBody).not.toHaveProperty('fips')
  expect(putBody).not.toHaveProperty('hva')
  expect(putBody).not.toHaveProperty('cloud_service_model')
})

test('an edited ISSO Name is sent in the save payload', async () => {
  mock.onGet('/systemattributes').reply(200, { data: [] })
  let putBody: Record<string, unknown> | undefined
  mock.onPut(/fismasystems\/42$/).reply((config) => {
    putBody = JSON.parse(config.data)
    return [200, {}]
  })
  const user = userEvent.setup()

  renderWithProviders(
    <EditSystemModal
      title="Edit"
      open
      onClose={jest.fn()}
      system={{ ...SYSTEM, isso_name: 'Conan Antonio Motti' }}
      mode="edit"
      datacenterEnvironments={[]}
      opdivs={OPDIVS}
    />
  )

  const input = await screen.findByRole('textbox', { name: 'ISSO Name' })
  await user.clear(input)
  await user.type(input, 'Firmus Piett')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(putBody).toBeDefined())
  expect(putBody).toHaveProperty('isso_name', 'Firmus Piett')
})

test('clearing ISSO Name saves an empty string, which restores the derived name', async () => {
  mock.onGet('/systemattributes').reply(200, { data: [] })
  let putBody: Record<string, unknown> | undefined
  mock.onPut(/fismasystems\/42$/).reply((config) => {
    putBody = JSON.parse(config.data)
    return [200, {}]
  })
  const user = userEvent.setup()

  renderWithProviders(
    <EditSystemModal
      title="Edit"
      open
      onClose={jest.fn()}
      system={{ ...SYSTEM, isso_name: 'Conan Antonio Motti' }}
      mode="edit"
      datacenterEnvironments={[]}
      opdivs={OPDIVS}
    />
  )

  await user.clear(await screen.findByRole('textbox', { name: 'ISSO Name' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(putBody).toBeDefined())
  // '' clears the stored override so the name derived from the ISSO user
  // record applies again; null would read as "leave unchanged".
  expect(putBody).toHaveProperty('isso_name', '')
})

test('clearing a free-text field saves an empty string, not null', async () => {
  mock.onGet('/systemattributes').reply(200, { data: [] })
  let putBody: Record<string, unknown> | undefined
  mock.onPut(/fismasystems\/42$/).reply((config) => {
    putBody = JSON.parse(config.data)
    return [200, {}]
  })
  const user = userEvent.setup()

  renderWithProviders(
    <EditSystemModal
      title="Edit"
      open
      onClose={jest.fn()}
      system={{ ...SYSTEM, cloud_vendor: 'AWS' }}
      mode="edit"
      datacenterEnvironments={[]}
      opdivs={OPDIVS}
    />
  )

  // Cloud Vendor is free text (no email/select branch); clear it and save.
  const input = await screen.findByRole('textbox', { name: 'Cloud Vendor' })
  await user.clear(input)
  await user.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(putBody).toBeDefined())
  // '' clears via blankToNil; null would read as "leave unchanged" and the
  // clear would silently no-op.
  expect(putBody).toHaveProperty('cloud_vendor', '')
})

// ---------------------------------------------------------------------------
// Core save paths: the existing tests above cover extended-
// metadata diffing; these pin the core-field payload, the 400 field-error
// routing, and the create-mode validation gate - the parts where a regression
// silently corrupts or fails a system write.
// ---------------------------------------------------------------------------

test('editing sends the core system fields in the PUT payload', async () => {
  mock.onGet('/systemattributes').reply(200, { data: [] })
  let putBody: Record<string, unknown> | undefined
  mock.onPut(/fismasystems\/42$/).reply((config) => {
    putBody = JSON.parse(config.data)
    return [200, {}]
  })
  const user = userEvent.setup()

  renderWithProviders(
    <EditSystemModal
      title="Edit"
      open
      onClose={jest.fn()}
      system={SYSTEM}
      mode="edit"
      datacenterEnvironments={[]}
      opdivs={OPDIVS}
    />
  )

  await user.click(await screen.findByRole('button', { name: 'Save' }))

  await waitFor(() => expect(putBody).toBeDefined())
  // The full core record is sent as-is, so an unrelated edit never drops a field.
  expect(putBody).toMatchObject({
    fismaname: 'Executor',
    fismaacronym: 'EXEC',
    fismauid: 'UID-42',
    component: 'CMS',
    datacenterenvironment: 'CMS-Cloud-AWS',
    issoemail: 'admiral.piett@executor.empire',
    datacallcontact: 'captain.needa@executor.empire',
    opdiv_id: 1,
  })
})

test('a 400 with a field map routes the reason inline and does not close the modal', async () => {
  mock.onGet('/systemattributes').reply(200, { data: [] })
  mock
    .onPut(/fismasystems\/42$/)
    .reply(400, { data: { fismaname: 'FISMA Name is already taken' } })
  const onClose = jest.fn()
  const user = userEvent.setup()

  renderWithProviders(
    <EditSystemModal
      title="Edit"
      open
      onClose={onClose}
      system={SYSTEM}
      mode="edit"
      datacenterEnvironments={[]}
      opdivs={OPDIVS}
    />
  )

  await user.click(await screen.findByRole('button', { name: 'Save' }))

  // The backend's per-field reason renders inline; the modal stays open so the
  // user can fix it rather than losing their edits to a closed dialog.
  expect(
    await screen.findByText('FISMA Name is already taken')
  ).toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
})

test('Create is disabled until the required fields are filled', async () => {
  mock.onGet('/systemattributes').reply(200, { data: [] })

  renderWithProviders(
    <EditSystemModal
      title="Add"
      open
      onClose={jest.fn()}
      system={EMPTY_SYSTEM as unknown as FismaSystemType}
      mode="create"
      datacenterEnvironments={[]}
      opdivs={OPDIVS}
    />
  )

  // An empty create form must not be submittable - guards against an empty POST.
  expect(await screen.findByRole('button', { name: 'Create' })).toBeDisabled()
})

test('a completed create form POSTs the new system and reports success', async () => {
  mock.onGet('/systemattributes').reply(200, { data: [] })
  let postBody: Record<string, unknown> | undefined
  mock.onPost('fismasystems').reply((config) => {
    postBody = JSON.parse(config.data)
    return [201, { data: { fismasystemid: 99 } }]
  })
  const onClose = jest.fn()
  const user = userEvent.setup()
  const DCE = [
    {
      datacenterenvironment: 'CMS-Cloud-AWS',
      category: 'Cloud',
      scoring_key: 'cloud',
      selectable: true,
      ordr: 1,
    },
  ]

  renderWithProviders(
    <EditSystemModal
      title="Add"
      open
      onClose={onClose}
      system={EMPTY_SYSTEM as unknown as FismaSystemType}
      mode="create"
      datacenterEnvironments={DCE}
      opdivs={OPDIVS}
    />
  )

  await user.type(
    await screen.findByRole('textbox', { name: 'Fisma Name' }),
    'New System'
  )
  await user.type(
    screen.getByRole('textbox', { name: 'Fisma Acronym' }),
    'NS-1'
  )
  await user.type(screen.getByRole('textbox', { name: 'Fisma UID' }), 'UID-99')
  await user.type(screen.getByRole('textbox', { name: 'Component' }), 'CMS')
  await user.type(
    screen.getByRole('textbox', { name: 'Data Call Contact' }),
    'contact@agency.gov'
  )
  await user.type(
    screen.getByRole('textbox', { name: 'ISSO Email' }),
    'isso@agency.gov'
  )

  // Two MUI selects: open, then pick the option.
  await user.click(screen.getByRole('combobox', { name: 'OpDiv' }))
  await user.click(await screen.findByRole('option', { name: /CMS/ }))
  await user.click(
    screen.getByRole('combobox', { name: 'Datacenter Environment' })
  )
  // The option label is the environment's category ("Cloud"); the saved value
  // is the environment string ("CMS-Cloud-AWS").
  await user.click(await screen.findByRole('option', { name: 'Cloud' }))

  const create = screen.getByRole('button', { name: 'Create' })
  await waitFor(() => expect(create).toBeEnabled())
  await user.click(create)

  await waitFor(() => expect(postBody).toBeDefined())
  expect(postBody).toMatchObject({
    fismaname: 'New System',
    fismaacronym: 'NS-1',
    fismauid: 'UID-99',
    component: 'CMS',
    datacallcontact: 'contact@agency.gov',
    issoemail: 'isso@agency.gov',
    datacenterenvironment: 'CMS-Cloud-AWS',
    opdiv_id: 1,
  })
  expect(onClose).toHaveBeenCalled()
})
