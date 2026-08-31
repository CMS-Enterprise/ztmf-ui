import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import { ERROR_MESSAGES } from '@/constants'

jest.mock('@/router/router', () => ({
  __esModule: true,
  default: { navigate: jest.fn() },
}))

// Replace @/axiosConfig with a fresh axios instance carrying the same
// interceptor. The production module accesses import.meta.env at top
// level and swc/jest leaves that literal in the CommonJS output, which
// throws on load.
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

import axiosInstance from '@/axiosConfig'
import router from '@/router/router'
import SystemEnrichmentCard from './SystemEnrichmentCard'
import { renderWithProviders } from '@/test-utils/renderWithProviders'

const mockedNavigate = (router as unknown as { navigate: jest.Mock }).navigate
const mock = new MockAdapter(axiosInstance)
const FISMA_UID = 'TEST-FISMA-UID'

beforeEach(() => {
  mock.reset()
  mockedNavigate.mockReset()
})

test('200 response renders the enrichment cards with payload fields', async () => {
  mock.onGet(`/systemenrichment/${FISMA_UID}`).reply(200, {
    data: {
      fisma_uuid: FISMA_UID,
      payload: {
        authorization_package_name: 'Test Package',
        fisma_acronym: 'TEST',
        component_acronym: 'CMS',
        primary_isso_name: 'Test ISSO',
        primary_isso_email: 'isso@example.com',
      },
      synced_at: '2026-01-01T00:00:00Z',
    },
  })

  renderWithProviders(<SystemEnrichmentCard fismaUid={FISMA_UID} />)

  expect(await screen.findByText('Test Package')).toBeInTheDocument()
  expect(screen.getByText('Test ISSO')).toBeInTheDocument()
})

// This is the key skipAuthHandling integration test: a 403 must produce
// the muted empty state, NOT the centralized permission snackbar. If
// the opt-out flag stops being honored upstream, this test fails.
test('403 renders the quiet empty state and the interceptor stays out of the way', async () => {
  mock.onGet(`/systemenrichment/${FISMA_UID}`).reply(403)

  renderWithProviders(<SystemEnrichmentCard fismaUid={FISMA_UID} />)

  expect(
    await screen.findByText(/no ztmf insights data found/i)
  ).toBeInTheDocument()
  // The opt-out is real: no permission snackbar fired anywhere.
  expect(screen.queryByText(ERROR_MESSAGES.permission)).not.toBeInTheDocument()
  // And no redirect either - skipAuthHandling bypasses both branches.
  expect(mockedNavigate).not.toHaveBeenCalled()
})

test('404 renders the same quiet empty state', async () => {
  mock.onGet(`/systemenrichment/${FISMA_UID}`).reply(404)

  renderWithProviders(<SystemEnrichmentCard fismaUid={FISMA_UID} />)

  expect(
    await screen.findByText(/no ztmf insights data found/i)
  ).toBeInTheDocument()
})

test('500 renders the failed-to-load message', async () => {
  mock.onGet(`/systemenrichment/${FISMA_UID}`).reply(500)

  renderWithProviders(<SystemEnrichmentCard fismaUid={FISMA_UID} />)

  expect(
    await screen.findByText(/failed to load ztmf insights data/i)
  ).toBeInTheDocument()
})

// Data center environment display + mismatch flag (ztmf#239)

test('renders the CFACTS data center environment and flags a mismatch with the ZTMF value', async () => {
  mock.onGet(`/systemenrichment/${FISMA_UID}`).reply(200, {
    data: {
      fisma_uuid: FISMA_UID,
      payload: {
        authorization_package_name: 'Test Package',
        data_center_environment: 'CMS-Cloud-AWS',
      },
      synced_at: '2026-01-01T00:00:00Z',
    },
  })

  renderWithProviders(
    <SystemEnrichmentCard
      fismaUid={FISMA_UID}
      systemDataCenterEnvironment="CMSDC"
    />
  )

  expect(await screen.findByText('CMS-Cloud-AWS')).toBeInTheDocument()
  expect(screen.getByText('Differs from ZTMF: CMSDC')).toBeInTheDocument()
})

test('does not flag a case/whitespace-only difference as a mismatch', async () => {
  mock.onGet(`/systemenrichment/${FISMA_UID}`).reply(200, {
    data: {
      fisma_uuid: FISMA_UID,
      payload: {
        authorization_package_name: 'Test Package',
        data_center_environment: ' cms-cloud-aws ',
      },
      synced_at: '2026-01-01T00:00:00Z',
    },
  })

  renderWithProviders(
    <SystemEnrichmentCard
      fismaUid={FISMA_UID}
      systemDataCenterEnvironment="CMS-Cloud-AWS"
    />
  )

  expect(await screen.findByText('Test Package')).toBeInTheDocument()
  expect(screen.queryByText(/differs from ztmf/i)).not.toBeInTheDocument()
})

test('flags a mismatch when CFACTS has a value but ZTMF has none recorded', async () => {
  mock.onGet(`/systemenrichment/${FISMA_UID}`).reply(200, {
    data: {
      fisma_uuid: FISMA_UID,
      payload: {
        authorization_package_name: 'Test Package',
        data_center_environment: 'SaaS',
      },
      synced_at: '2026-01-01T00:00:00Z',
    },
  })

  renderWithProviders(<SystemEnrichmentCard fismaUid={FISMA_UID} />)

  expect(await screen.findByText('SaaS')).toBeInTheDocument()
  expect(screen.getByText('Differs from ZTMF: not set')).toBeInTheDocument()
})

test('renders the placeholder and no mismatch flag while the pipeline has not shipped the field', async () => {
  mock.onGet(`/systemenrichment/${FISMA_UID}`).reply(200, {
    data: {
      fisma_uuid: FISMA_UID,
      payload: {
        authorization_package_name: 'Test Package',
      },
      synced_at: '2026-01-01T00:00:00Z',
    },
  })

  renderWithProviders(
    <SystemEnrichmentCard
      fismaUid={FISMA_UID}
      systemDataCenterEnvironment="CMSDC"
    />
  )

  expect(await screen.findByText('Test Package')).toBeInTheDocument()
  expect(screen.getByText('Data Center Environment')).toBeInTheDocument()
  expect(screen.queryByText(/differs from ztmf/i)).not.toBeInTheDocument()
})

test('formats a timestamp-format ATO expiration date instead of "Invalid Date"', async () => {
  mock.onGet(`/systemenrichment/${FISMA_UID}`).reply(200, {
    data: {
      fisma_uuid: FISMA_UID,
      payload: {
        authorization_package_name: 'Test Package',
        ato_expiration_date: '2026-12-13 00:00:00.000',
      },
      synced_at: '2026-01-01T00:00:00Z',
    },
  })

  renderWithProviders(<SystemEnrichmentCard fismaUid={FISMA_UID} />)

  expect(await screen.findByText('Test Package')).toBeInTheDocument()
  expect(screen.getByText('12/13/2026')).toBeInTheDocument()
  expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument()
})

test('renders the placeholder when no ATO expiration date is present', async () => {
  mock.onGet(`/systemenrichment/${FISMA_UID}`).reply(200, {
    data: {
      fisma_uuid: FISMA_UID,
      payload: {
        authorization_package_name: 'Test Package',
        ato_expiration_date: null,
      },
      synced_at: '2026-01-01T00:00:00Z',
    },
  })

  renderWithProviders(<SystemEnrichmentCard fismaUid={FISMA_UID} />)

  expect(await screen.findByText('Test Package')).toBeInTheDocument()
  expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument()
})

// Contacts roster + ISSO mismatch callout (ztmf-ui#720)

function enrichmentReply(payload: Record<string, unknown>) {
  mock.onGet(`/systemenrichment/${FISMA_UID}`).reply(200, {
    data: {
      fisma_uuid: FISMA_UID,
      payload,
      synced_at: '2026-01-01T00:00:00Z',
    },
  })
}

test('renders the full roster sorted by role order with unknown roles appended', async () => {
  enrichmentReply({
    contacts: [
      { role: 'CRA', name: 'Wedge Antilles', email: 'wedge@rebels.example' },
      { role: 'Chief Droid', name: 'R2-D2' },
      {
        role: 'Primary ISSO',
        name: 'Leia Organa',
        email: 'leia@rebels.example',
      },
      { role: 'BO', email: 'ackbar@rebels.example' },
    ],
  })

  renderWithProviders(<SystemEnrichmentCard fismaUid={FISMA_UID} />)

  expect(await screen.findByText('Leia Organa')).toBeInTheDocument()
  const roles = ['Primary ISSO', 'BO', 'CRA', 'Chief Droid']
  const rendered = roles.map((r) => screen.getByText(r))
  // DOM order follows the canonical role order, unknown role last.
  for (let i = 1; i < rendered.length; i++) {
    expect(
      rendered[i - 1].compareDocumentPosition(rendered[i]) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  }
  // Absent keys never leak as text.
  expect(screen.queryByText(/undefined/)).not.toBeInTheDocument()
  // Email-only entry renders its email as the value line.
  expect(screen.getByText('ackbar@rebels.example')).toBeInTheDocument()
})

test('repeated roles stack under a single role section', async () => {
  enrichmentReply({
    contacts: [
      {
        role: 'Primary ISSO',
        name: 'Leia Organa',
        email: 'leia@rebels.example',
      },
      { role: 'ISSO', name: 'Han Solo', email: 'han@rebels.example' },
      { role: 'ISSO', name: 'Chewbacca', email: 'chewie@rebels.example' },
      { role: 'ISSO', name: 'Lando Calrissian' },
    ],
  })

  renderWithProviders(<SystemEnrichmentCard fismaUid={FISMA_UID} />)

  expect(await screen.findByText('Han Solo')).toBeInTheDocument()
  // One section label for the three ISSOs, not one per person.
  expect(screen.getAllByText('ISSO')).toHaveLength(1)
  expect(screen.getByText('Chewbacca')).toBeInTheDocument()
  expect(screen.getByText('Lando Calrissian')).toBeInTheDocument()
})

test('falls back to the primary ISSO pair when the payload has no contacts key', async () => {
  enrichmentReply({
    primary_isso_name: 'Leia Organa',
    primary_isso_email: 'leia@rebels.example',
  })

  renderWithProviders(<SystemEnrichmentCard fismaUid={FISMA_UID} />)

  expect(await screen.findByText('Primary ISSO Name')).toBeInTheDocument()
  expect(screen.getByText('Leia Organa')).toBeInTheDocument()
  expect(screen.getByText('leia@rebels.example')).toBeInTheDocument()
})

test('flags a mismatch between the ZTMF ISSO and the CFACTS primary ISSO', async () => {
  enrichmentReply({
    contacts: [
      {
        role: 'Primary ISSO',
        name: 'Leia Organa',
        email: 'leia@rebels.example',
      },
    ],
  })

  renderWithProviders(
    <SystemEnrichmentCard
      fismaUid={FISMA_UID}
      ztmfIssoEmail="han@rebels.example"
      ztmfIssoName="Han Solo"
    />
  )

  const alert = await screen.findByText(/does not match CFACTS/i)
  const box = alert.closest('.MuiAlert-root') as HTMLElement
  expect(
    within(box).getByText(/Han Solo \(han@rebels\.example\)/)
  ).toBeInTheDocument()
  expect(
    within(box).getByText(/Leia Organa \(leia@rebels\.example\)/)
  ).toBeInTheDocument()
})

test('does not flag when emails match case-insensitively', async () => {
  enrichmentReply({
    contacts: [
      {
        role: 'Primary ISSO',
        name: 'Organa, Leia',
        email: 'Leia@Rebels.example',
      },
    ],
  })

  renderWithProviders(
    <SystemEnrichmentCard
      fismaUid={FISMA_UID}
      ztmfIssoEmail="leia@rebels.example"
      ztmfIssoName="Leia Organa"
    />
  )

  expect(await screen.findByText('Contacts')).toBeInTheDocument()
  expect(screen.queryByText(/does not match CFACTS/i)).not.toBeInTheDocument()
})

test('falls back to normalized name comparison only when an email is missing', async () => {
  // CFACTS has a name but no email; names are the same person in the two
  // formats, so no callout.
  enrichmentReply({
    contacts: [{ role: 'Primary ISSO', name: 'Organa, Leia' }],
  })

  renderWithProviders(
    <SystemEnrichmentCard
      fismaUid={FISMA_UID}
      ztmfIssoEmail="leia@rebels.example"
      ztmfIssoName="Leia Organa"
    />
  )

  expect(await screen.findByText('Contacts')).toBeInTheDocument()
  expect(screen.queryByText(/does not match CFACTS/i)).not.toBeInTheDocument()
})

test('missing data on either side is unknown, not a mismatch', async () => {
  enrichmentReply({
    contacts: [
      {
        role: 'Primary ISSO',
        name: 'Leia Organa',
        email: 'leia@rebels.example',
      },
    ],
  })

  renderWithProviders(<SystemEnrichmentCard fismaUid={FISMA_UID} />)

  expect(await screen.findByText('Contacts')).toBeInTheDocument()
  expect(screen.queryByText(/does not match CFACTS/i)).not.toBeInTheDocument()
})

test('admin sees the update action and it PUTs only the ISSO fields', async () => {
  enrichmentReply({
    contacts: [
      {
        role: 'Primary ISSO',
        name: 'Leia Organa',
        email: 'leia@rebels.example',
      },
    ],
  })
  mock.onPut('/fismasystems/42').reply(200)
  const onIssoUpdated = jest.fn()

  const user = userEvent.setup()
  renderWithProviders(
    <SystemEnrichmentCard
      fismaUid={FISMA_UID}
      ztmfIssoEmail="han@rebels.example"
      fismaSystemId={42}
      isAdmin
      onIssoUpdated={onIssoUpdated}
    />
  )

  const button = await screen.findByRole('button', {
    name: /update ztmf to match cfacts/i,
  })
  await user.click(button)

  expect(mock.history.put).toHaveLength(1)
  expect(JSON.parse(mock.history.put[0].data)).toEqual({
    issoemail: 'leia@rebels.example',
    isso_name: 'Leia Organa',
  })
  expect(onIssoUpdated).toHaveBeenCalled()
})

test('non-admins get the read-only callout with no update action', async () => {
  enrichmentReply({
    contacts: [
      {
        role: 'Primary ISSO',
        name: 'Leia Organa',
        email: 'leia@rebels.example',
      },
    ],
  })

  renderWithProviders(
    <SystemEnrichmentCard
      fismaUid={FISMA_UID}
      ztmfIssoEmail="han@rebels.example"
      fismaSystemId={42}
    />
  )

  expect(await screen.findByText(/does not match CFACTS/i)).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: /update ztmf to match cfacts/i })
  ).not.toBeInTheDocument()
})
