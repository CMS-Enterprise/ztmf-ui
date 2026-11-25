import { render, screen } from '@testing-library/react'
import QuestionHeading from './QuestionHeading'

const props = {
  pillar: 'Identity',
  functionName: 'Authentication',
  current: 2,
  total: 5,
  question: 'How are users authenticated?',
  description: 'Covers MFA and phishing resistance.',
}

describe('QuestionHeading', () => {
  it('renders the question as the card heading with its description', () => {
    render(<QuestionHeading {...props} />)
    expect(
      screen.getByRole('heading', { level: 2, name: props.question })
    ).toBeInTheDocument()
    expect(screen.getByText(props.description)).toBeInTheDocument()
  })

  it('omits the description when there is none', () => {
    render(<QuestionHeading {...props} description="" />)
    expect(screen.queryByText(props.description)).not.toBeInTheDocument()
  })
})
