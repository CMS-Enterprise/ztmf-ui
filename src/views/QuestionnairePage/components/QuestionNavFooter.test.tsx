import { fireEvent, render, screen } from '@testing-library/react'
import QuestionNavFooter from './QuestionNavFooter'

const base = {
  previousDisabled: false,
  onPrevious: jest.fn(),
  saveIndicator: { lastSavedAt: null, isReadOnly: false },
  nextDisabled: false,
  onNext: jest.fn(),
  nextLabel: 'Next question >',
  navHint: 'Saves this answer and opens the next question.',
}

describe('QuestionNavFooter', () => {
  it('wires Previous and Next, and describes Next with its hint', () => {
    const onPrevious = jest.fn()
    const onNext = jest.fn()
    render(
      <QuestionNavFooter {...base} onPrevious={onPrevious} onNext={onNext} />
    )
    fireEvent.click(screen.getByRole('button', { name: '< Previous' }))
    const next = screen.getByRole('button', { name: 'Next question >' })
    expect(next).toHaveAccessibleDescription(base.navHint)
    fireEvent.click(next)
    expect(onPrevious).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('offers View history only when there is history', () => {
    const onViewHistory = jest.fn()
    const { rerender } = render(<QuestionNavFooter {...base} />)
    expect(
      screen.queryByRole('button', { name: 'View history' })
    ).not.toBeInTheDocument()
    rerender(<QuestionNavFooter {...base} onViewHistory={onViewHistory} />)
    fireEvent.click(screen.getByRole('button', { name: 'View history' }))
    expect(onViewHistory).toHaveBeenCalled()
  })

  it('drops the description when there is no hint', () => {
    render(<QuestionNavFooter {...base} navHint="" nextLabel="Complete" />)
    expect(
      screen.getByRole('button', { name: 'Complete' })
    ).not.toHaveAttribute('aria-describedby')
  })
})
