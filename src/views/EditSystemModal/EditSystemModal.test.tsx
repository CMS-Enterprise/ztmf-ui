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
import axiosInstance from '@/axiosConfig'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import type { FismaSystemType } from '@/types'

const mock = new MockAdapter(axiosInstance)
afterEach(() => mock.reset())
// The modal fetches the OpDiv reference list on open; a bare response keeps the
// form out of its loading state.
beforeEach(() =>
  mock.onGet('/opdivs').reply(200, { data: [{ opdiv_id: 1, name: 'CMS' }] })
)

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
