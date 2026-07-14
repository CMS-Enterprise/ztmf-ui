import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// jest.mock calls must precede the imports of the mocked modules.
jest.mock('@/router/router', () => ({
  __esModule: true,
  default: { navigate: jest.fn() },
}))

jest.mock('@/utils/notify', () => ({
  __esModule: true,
  notify: jest.fn(),
  isAuthHandled: jest.fn().mockReturnValue(false),
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

import MockAdapter from 'axios-mock-adapter'
import axiosInstance from '@/axiosConfig'
import TargetMaturityCard from './TargetMaturityCard'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import type { FismaSystemType } from '@/types'

const BASE_SYSTEM = {
  fismasystemid: 1001,
  fismaname: 'Death Star',
  fismaacronym: 'DS-1',
  target_maturity_tier: null,
  target_maturity_justification: null,
} as unknown as FismaSystemType

const mock = new MockAdapter(axiosInstance)

function renderCard(
  overrides: Partial<Parameters<typeof TargetMaturityCard>[0]> = {}
) {
  const props = {
    system: BASE_SYSTEM,
    canEdit: true,
    onSaved: jest.fn(),
    ...overrides,
  }
  return {
    ...renderWithProviders(<TargetMaturityCard {...props} />),
    onSaved: props.onSaved,
  }
}

beforeEach(() => {
  mock.reset()
})

// ---------------------------------------------------------------------------
// View mode
// ---------------------------------------------------------------------------

test('no target set renders the Advanced default with the default caption', () => {
  renderCard({ canEdit: false })
  expect(screen.getByText('3 — Advanced (default)')).toBeInTheDocument()
  expect(
    screen.getByText(/Default — no target has been set/)
  ).toBeInTheDocument()
  // No form controls in view mode
  expect(screen.queryByLabelText('Target level')).not.toBeInTheDocument()
  expect(screen.queryByText('Justification')).not.toBeInTheDocument()
})

test('explicit target renders tier chip and justification', () => {
  renderCard({
    canEdit: false,
    system: {
      ...BASE_SYSTEM,
      target_maturity_tier: 'Optimal',
      target_maturity_justification: 'Internet-facing HVA.',
    },
  })
  expect(screen.getByText('4 — Optimal')).toBeInTheDocument()
  expect(screen.getByText('Internet-facing HVA.')).toBeInTheDocument()
  expect(screen.queryByText(/Default — no target/)).not.toBeInTheDocument()
})

// ---------------------------------------------------------------------------
// Edit affordance gating
// ---------------------------------------------------------------------------

test('canEdit=false hides the Edit button in view mode', () => {
  renderCard({ canEdit: false })
  expect(screen.queryByRole('button', { name: /^edit$/i })).toBeNull()
})

test('canEdit=true shows the Edit button in view mode', () => {
  renderCard({ canEdit: true })
  expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument()
})

// ---------------------------------------------------------------------------
// Enter edit mode
// ---------------------------------------------------------------------------

test('clicking Edit swaps view mode for the tier + justification form seeded from the system', async () => {
  const user = userEvent.setup()
  renderCard({
    system: {
      ...BASE_SYSTEM,
      target_maturity_tier: 'Optimal',
      target_maturity_justification: 'Internet-facing HVA.',
    },
  })
  await user.click(screen.getByRole('button', { name: /^edit$/i }))

  expect(screen.getByLabelText('Target level')).toBeInTheDocument()
  expect(screen.getByLabelText('Justification')).toBeInTheDocument()
  // Seeded from the system
  expect(screen.getByLabelText('Justification')).toHaveValue(
    'Internet-facing HVA.'
  )
  // Save + Cancel buttons appear
  expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument()
})

test('only Initial, Advanced, and Optimal are offered - no Traditional', async () => {
  const user = userEvent.setup()
  renderCard()
  await user.click(screen.getByRole('button', { name: /^edit$/i }))
  await user.click(screen.getByLabelText('Target level'))
  const options = await screen.findAllByRole('option')
  expect(options.map((o) => o.textContent)).toEqual([
    '2 — Initial',
    '3 — Advanced (default)',
    '4 — Optimal',
  ])
})

// ---------------------------------------------------------------------------
// Save flow
// ---------------------------------------------------------------------------

test('Save is disabled when nothing has changed', async () => {
  const user = userEvent.setup()
  renderCard({
    system: {
      ...BASE_SYSTEM,
      target_maturity_tier: 'Optimal',
      target_maturity_justification: 'Existing reason.',
    },
  })
  await user.click(screen.getByRole('button', { name: /^edit$/i }))
  expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
})

test('Save is disabled when the draft is dirty but the justification is empty', async () => {
  const user = userEvent.setup()
  renderCard()
  await user.click(screen.getByRole('button', { name: /^edit$/i }))
  // Pick a different tier so isDirty flips true
  await user.click(screen.getByLabelText('Target level'))
  await user.click(await screen.findByRole('option', { name: '4 — Optimal' }))
  expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
})

test('successful save PUTs to /target-maturity, calls onSaved, exits edit mode', async () => {
  const user = userEvent.setup()
  const saved: FismaSystemType = {
    ...BASE_SYSTEM,
    target_maturity_tier: 'Optimal',
    target_maturity_justification: 'Internet-facing HVA.',
  }
  mock
    .onPut(`/fismasystems/${BASE_SYSTEM.fismasystemid}/target-maturity`)
    .reply(200, { data: saved })

  const { onSaved } = renderCard()
  await user.click(screen.getByRole('button', { name: /^edit$/i }))
  await user.click(screen.getByLabelText('Target level'))
  await user.click(await screen.findByRole('option', { name: '4 — Optimal' }))
  await user.type(
    screen.getByLabelText('Justification'),
    'Internet-facing HVA.'
  )
  await user.click(screen.getByRole('button', { name: /^save$/i }))

  await waitFor(() => expect(mock.history.put).toHaveLength(1))
  const body = JSON.parse(mock.history.put[0].data)
  expect(body).toEqual({
    target_maturity_tier: 'Optimal',
    target_maturity_justification: 'Internet-facing HVA.',
  })
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved))
  // Back in view mode
  await waitFor(() =>
    expect(screen.queryByLabelText('Justification')).not.toBeInTheDocument()
  )
})

test('save trims the justification before sending', async () => {
  const user = userEvent.setup()
  mock
    .onPut(`/fismasystems/${BASE_SYSTEM.fismasystemid}/target-maturity`)
    .reply(200, {
      data: {
        ...BASE_SYSTEM,
        target_maturity_tier: 'Optimal',
        target_maturity_justification: 'trimmed',
      },
    })

  renderCard()
  await user.click(screen.getByRole('button', { name: /^edit$/i }))
  await user.click(screen.getByLabelText('Target level'))
  await user.click(await screen.findByRole('option', { name: '4 — Optimal' }))
  await user.type(screen.getByLabelText('Justification'), '  trimmed  ')
  await user.click(screen.getByRole('button', { name: /^save$/i }))

  await waitFor(() => expect(mock.history.put).toHaveLength(1))
  const body = JSON.parse(mock.history.put[0].data)
  expect(body.target_maturity_justification).toBe('trimmed')
})

test('over-limit justification blocks Save and shows the length error', async () => {
  const user = userEvent.setup()
  renderCard()
  await user.click(screen.getByRole('button', { name: /^edit$/i }))
  await user.click(screen.getByLabelText('Target level'))
  await user.click(await screen.findByRole('option', { name: '4 — Optimal' }))
  const field = screen.getByLabelText('Justification') as HTMLInputElement
  // userEvent.type on a 1001-char string is very slow; write directly
  // via fireEvent through the underlying input.
  field.focus()
  Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value'
  )?.set?.call(field, 'x'.repeat(1001))
  field.dispatchEvent(new Event('input', { bubbles: true }))

  expect(
    screen.getByText('Must be 1000 characters or fewer')
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
})

// ---------------------------------------------------------------------------
// Cancel flow
// ---------------------------------------------------------------------------

test('Cancel with no changes exits edit mode immediately (no confirm dialog)', async () => {
  const user = userEvent.setup()
  renderCard()
  await user.click(screen.getByRole('button', { name: /^edit$/i }))
  await user.click(screen.getByRole('button', { name: /^cancel$/i }))

  expect(screen.queryByLabelText('Justification')).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('Cancel with dirty draft opens the ConfirmDialog; confirming discards', async () => {
  const user = userEvent.setup()
  renderCard()
  await user.click(screen.getByRole('button', { name: /^edit$/i }))
  // Dirty the draft: swap tier + add justification
  await user.click(screen.getByLabelText('Target level'))
  await user.click(await screen.findByRole('option', { name: '4 — Optimal' }))
  await user.type(screen.getByLabelText('Justification'), 'draft')

  await user.click(screen.getByRole('button', { name: /^cancel$/i }))
  // ConfirmDialog uses "Confirm" as the default confirm-button label
  const confirmButton = await screen.findByRole('button', {
    name: /^confirm$/i,
  })
  await user.click(confirmButton)

  // Back in view mode, drafts discarded
  await waitFor(() =>
    expect(screen.queryByLabelText('Justification')).not.toBeInTheDocument()
  )
})

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

test('server error keeps the user in edit mode and does not call onSaved', async () => {
  const user = userEvent.setup()
  mock
    .onPut(`/fismasystems/${BASE_SYSTEM.fismasystemid}/target-maturity`)
    .reply(500)

  const { onSaved } = renderCard()
  await user.click(screen.getByRole('button', { name: /^edit$/i }))
  await user.click(screen.getByLabelText('Target level'))
  await user.click(await screen.findByRole('option', { name: '4 — Optimal' }))
  await user.type(screen.getByLabelText('Justification'), 'reason')
  await user.click(screen.getByRole('button', { name: /^save$/i }))

  await waitFor(() => expect(mock.history.put).toHaveLength(1))
  expect(onSaved).not.toHaveBeenCalled()
  // Still in edit mode
  expect(screen.getByLabelText('Justification')).toBeInTheDocument()
})
