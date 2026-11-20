import { fireEvent, render, screen } from '@testing-library/react'
import EvidenceNotesField, { DEFAULT_NOTES_PROMPT } from './EvidenceNotesField'

describe('EvidenceNotesField', () => {
  it('labels the field and reports edits', () => {
    const onChange = jest.fn()
    render(
      <EvidenceNotesField
        value=""
        onChange={onChange}
        notePrompt=""
        disabled={false}
      />
    )
    const field = screen.getByLabelText(/supporting evidence/i)
    expect(field).toHaveAttribute('placeholder', DEFAULT_NOTES_PROMPT)
    fireEvent.change(field, { target: { value: 'link' } })
    expect(onChange).toHaveBeenCalledWith('link')
  })

  it('shows the error text when the notes need updating', () => {
    render(
      <EvidenceNotesField
        value=""
        onChange={jest.fn()}
        notePrompt="Prompt"
        disabled={false}
        errorText="Update the notes"
      />
    )
    expect(screen.getByText('Update the notes')).toBeInTheDocument()
    expect(screen.getByLabelText(/supporting evidence/i)).toHaveAttribute(
      'aria-invalid',
      'true'
    )
  })
})
