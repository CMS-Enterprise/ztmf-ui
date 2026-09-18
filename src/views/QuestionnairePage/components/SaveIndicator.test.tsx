import { render, screen } from '@testing-library/react'
import SaveIndicator, { SaveIndicatorEditor } from './SaveIndicator'

describe('SaveIndicator', () => {
  const editor: SaveIndicatorEditor = {
    userid: '9f000000-0000-0000-0000-000000000001',
    name: 'John Smith',
    email: 'john.smith@cms.hhs.gov',
    role: 'ISSO',
  }
  // Old enough that relativeTimeFrom falls back to an absolute date, matching
  // the "Saved <date>" the questionnaire footer shows on a fresh load.
  const editedAt = '2026-04-14T22:12:40Z'

  it('names the editor inline beside the saved timestamp', () => {
    // The pre-redesign footer attributed the change by name; the redesign must
    // keep that visible, not hide it behind the hover tooltip.
    render(
      <SaveIndicator
        lastSavedAt={new Date(editedAt)}
        lastEditedAt={editedAt}
        lastEditedBy={editor}
        isReadOnly={false}
      />
    )
    expect(screen.getByText(/by John Smith$/)).toBeInTheDocument()
  })

  it('omits the "by" clause when no editor is known', () => {
    render(
      <SaveIndicator
        lastSavedAt={new Date(editedAt)}
        lastEditedAt={null}
        lastEditedBy={null}
        isReadOnly={false}
      />
    )
    expect(screen.queryByText(/ by /)).not.toBeInTheDocument()
    expect(screen.getByText(/^Saved /)).toBeInTheDocument()
  })

  it('shows a Read-only tag instead of a timestamp when the user cannot edit', () => {
    render(
      <SaveIndicator
        lastSavedAt={new Date(editedAt)}
        lastEditedAt={editedAt}
        lastEditedBy={editor}
        isReadOnly
      />
    )
    expect(screen.getByText('Read-only')).toBeInTheDocument()
    expect(screen.queryByText(/John Smith/)).not.toBeInTheDocument()
  })
})
