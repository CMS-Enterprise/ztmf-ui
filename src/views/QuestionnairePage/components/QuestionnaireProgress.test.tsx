import { render, screen } from '@testing-library/react'
import QuestionnaireProgress from './QuestionnaireProgress'

describe('QuestionnaireProgress', () => {
  it('floors the percentage and names the counts for screen readers', () => {
    render(<QuestionnaireProgress answered={21} total={40} />)
    // 21/40 = 52.5 -> floored to 52, never rounded up to 53.
    expect(screen.getByText('52%')).toBeInTheDocument()
    expect(screen.getByText('21 of 40')).toBeInTheDocument()
    const bar = screen.getByRole('progressbar', {
      name: /overall questionnaire completion, 21 of 40 questions answered/i,
    })
    expect(bar).toHaveAttribute('aria-valuenow', '52')
  })

  it('only shows 100% at genuine completion, never from rounding', () => {
    // 199/200 = 99.5% would round to 100 but must floor to 99 while incomplete.
    render(<QuestionnaireProgress answered={199} total={200} />)
    expect(screen.getByText('99%')).toBeInTheDocument()
    expect(screen.queryByText('100%')).not.toBeInTheDocument()
  })

  it('reaches 100% when every question is answered', () => {
    render(<QuestionnaireProgress answered={6} total={6} />)
    const bar = screen.getByRole('progressbar')
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(bar).toHaveAttribute('aria-valuenow', '100')
  })

  it('reserves height with a skeleton before questions load (no progressbar)', () => {
    const { container } = render(
      <QuestionnaireProgress answered={0} total={0} />
    )
    // Height is reserved (not an empty node), but nothing is announced yet.
    expect(container).not.toBeEmptyDOMElement()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})
