import { render, screen } from '@testing-library/react'
import { MAX_QUESTIONNAIRE_NOTES_LENGTH } from '@/constants'
import NotesFooter from './NotesFooter'

describe('NotesFooter', () => {
  it('shows the prompt and counter when given', () => {
    render(<NotesFooter showAiBadge={false} prompt="Add links" count={12} />)
    expect(screen.getByText('Add links')).toBeInTheDocument()
    expect(
      screen.getByText(`12 / ${MAX_QUESTIONNAIRE_NOTES_LENGTH}`)
    ).toBeInTheDocument()
  })

  it('omits the prompt and counter when JustificationField owns them', () => {
    render(<NotesFooter showAiBadge={false} />)
    expect(screen.queryByText(/\//)).not.toBeInTheDocument()
  })
})
