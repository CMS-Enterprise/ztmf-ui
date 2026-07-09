import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

jest.mock('@/router/router', () => ({
  __esModule: true,
  default: { navigate: jest.fn() },
}))

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

const noop = () => {}

function renderCard(
  overrides: Partial<Parameters<typeof TargetMaturityCard>[0]> = {}
) {
  const props = {
    system: BASE_SYSTEM,
    isEditing: false,
    tier: 'Advanced',
    justification: '',
    onTierChange: noop,
    onJustificationChange: noop,
    ...overrides,
  }
  return renderWithProviders(<TargetMaturityCard {...props} />)
}

test('no target set renders the Advanced default with the default caption', () => {
  renderCard()
  expect(screen.getByText('3 — Advanced (default)')).toBeInTheDocument()
  expect(
    screen.getByText(/Default — no target has been set/)
  ).toBeInTheDocument()
  // Read mode: no form controls, no justification block
  expect(screen.queryByLabelText('Target level')).not.toBeInTheDocument()
  expect(screen.queryByText('Justification')).not.toBeInTheDocument()
})

test('explicit target renders tier chip and justification', () => {
  renderCard({
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

test('isEditing renders the controlled tier select and justification field', async () => {
  const user = userEvent.setup()
  const onTierChange = jest.fn()
  const onJustificationChange = jest.fn()
  renderCard({
    isEditing: true,
    tier: 'Advanced',
    justification: '',
    onTierChange,
    onJustificationChange,
  })

  // Empty justification is flagged as required while editing
  expect(screen.getByLabelText('Justification')).toBeInvalid()

  // Selecting a tier lifts the change to the page
  await user.click(screen.getByLabelText('Target level'))
  await user.click(await screen.findByRole('option', { name: '4 — Optimal' }))
  expect(onTierChange).toHaveBeenCalledWith('Optimal')

  // Typing lifts justification changes to the page
  await user.type(screen.getByLabelText('Justification'), 'B')
  expect(onJustificationChange).toHaveBeenCalledWith('B')
})

test('only Initial, Advanced, and Optimal are offered - no Traditional', async () => {
  const user = userEvent.setup()
  renderCard({ isEditing: true })
  await user.click(screen.getByLabelText('Target level'))
  const options = await screen.findAllByRole('option')
  expect(options.map((o) => o.textContent)).toEqual([
    '2 — Initial',
    '3 — Advanced (default)',
    '4 — Optimal',
  ])
})

test('over-limit justification shows the length error', () => {
  renderCard({
    isEditing: true,
    justification: 'x'.repeat(1001),
  })
  expect(
    screen.getByText('Must be 1000 characters or fewer')
  ).toBeInTheDocument()
  expect(screen.getByLabelText('Justification')).toBeInvalid()
})
