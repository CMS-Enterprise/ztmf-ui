// Covers the celebration gating: the end-of-questionnaire summary fires
// confetti only when every question is answered (outstanding === 0), never
// when something is still unconfirmed or unanswered. confetti.create returns
// the fire function that launches the particles; asserting on it proves the
// burst did or did not happen. See @/test-utils/confettiMock for the double.

jest.mock('canvas-confetti', () =>
  require('@/test-utils/confettiMock').confettiMockFactory()
)

import { render, screen } from '@testing-library/react'
import ConfirmSummaryDialog from './ConfirmSummaryDialog'
import type { ConfirmSummary, ConfirmSummaryEntry } from './confirmState'
import {
  confettiFireMock,
  reinstallConfettiMock,
} from '@/test-utils/confettiMock'

beforeEach(() => {
  // A concrete non-reduced-motion preference so the burst is not suppressed
  // for reasons unrelated to completeness.
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }) as unknown as typeof window.matchMedia
  reinstallConfettiMock()
})

const entry = (functionid: number): ConfirmSummaryEntry => ({
  functionid,
  functionName: `Function ${functionid}`,
  pillarName: 'Identity',
})

const summary = (over: Partial<ConfirmSummary>): ConfirmSummary => ({
  total: 3,
  updated: 3,
  unconfirmed: [],
  unanswered: [],
  hasStatusData: true,
  ...over,
})

test('fires confetti when the questionnaire is fully complete', () => {
  render(
    <ConfirmSummaryDialog
      summary={summary({ unconfirmed: [], unanswered: [] })}
      onClose={jest.fn()}
      onJump={jest.fn()}
    />
  )

  expect(screen.getByText('Questionnaire complete')).toBeInTheDocument()
  expect(confettiFireMock).toHaveBeenCalledTimes(1)
})

test('does not fire confetti when questions are still unanswered', () => {
  render(
    <ConfirmSummaryDialog
      summary={summary({ updated: 2, unanswered: [entry(11)] })}
      onClose={jest.fn()}
      onJump={jest.fn()}
    />
  )

  expect(screen.getByText('Before you finish')).toBeInTheDocument()
  expect(confettiFireMock).not.toHaveBeenCalled()
})

test('does not fire confetti when a carried-forward answer is unconfirmed', () => {
  render(
    <ConfirmSummaryDialog
      summary={summary({ updated: 2, unconfirmed: [entry(11)] })}
      onClose={jest.fn()}
      onJump={jest.fn()}
    />
  )

  expect(confettiFireMock).not.toHaveBeenCalled()
})
