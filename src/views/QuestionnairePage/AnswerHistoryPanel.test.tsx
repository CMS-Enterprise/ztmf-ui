import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import AnswerHistoryPanel from './AnswerHistoryPanel'
import type { ScoreRevision } from '@/types'

const side = (over: Partial<ScoreRevision['new']> = {}) => ({
  functionoptionid: 5,
  optionname: 'Traditional',
  score: 1,
  notes: 'original justification',
  notes_is_ai_summary: false,
  status: 'done' as const,
  ...over,
})

const revision = (over: Partial<ScoreRevision> = {}): ScoreRevision => ({
  revisionid: 91,
  scoreid: 4212,
  revision_no: 2,
  kind: 'update',
  createdat: '2026-09-18T14:02:11Z',
  actor: {
    userid: 'u-1',
    name: 'Isso User',
    email: 'isso.user@nowhere.xyz',
    role: 'ISSO',
  },
  prev: side(),
  new: side({
    functionoptionid: 6,
    optionname: 'Advanced',
    score: 3,
    notes: 'revised justification',
  }),
  undoable: true,
  ...over,
})

const props = {
  open: true,
  onClose: jest.fn(),
  revisions: [revision()],
  isPending: false,
  isError: false,
  isUndoing: false,
  onUndo: jest.fn(),
}

afterEach(() => jest.clearAllMocks())

it('shows who changed the answer, when, and both sides of the change', () => {
  renderWithProviders(<AnswerHistoryPanel {...props} />)

  expect(screen.getByText('Changed the answer')).toBeInTheDocument()
  expect(screen.getByText(/Isso User \(ISSO\)/)).toBeInTheDocument()
  // Both sides render through the cell shared with ScoreDiffModal.
  expect(screen.getByText('Traditional')).toBeInTheDocument()
  expect(screen.getByText('Advanced')).toBeInTheDocument()
  expect(screen.getByText('original justification')).toBeInTheDocument()
  expect(screen.getByText('revised justification')).toBeInTheDocument()
})

it('offers the undo action on the head and reports the revision it targets', () => {
  renderWithProviders(<AnswerHistoryPanel {...props} />)

  fireEvent.click(screen.getByRole('button', { name: 'Undo last change' }))
  expect(props.onUndo).toHaveBeenCalledWith(91)
})

it('labels an undo of a confirm for what it is', () => {
  renderWithProviders(
    <AnswerHistoryPanel
      {...props}
      revisions={[revision({ kind: 'confirm' })]}
    />
  )

  expect(screen.getByText('Confirmed as still accurate')).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Undo confirmation' })
  ).toBeInTheDocument()
})

/**
 * The panel must never decide undo eligibility for itself. The server marks a
 * revision undoable or not and supplies the reason; rendering that string
 * verbatim is what keeps the policy in one place.
 */
it('renders the server reason instead of a button when a revision is not undoable', () => {
  renderWithProviders(
    <AnswerHistoryPanel
      {...props}
      revisions={[
        revision({
          undoable: false,
          reason: 'An undo cannot itself be undone.',
        }),
      ]}
    />
  )

  expect(
    screen.getByText('An undo cannot itself be undone.')
  ).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Undo/ })).not.toBeInTheDocument()
})

it('offers no action on older revisions, only on the head', () => {
  renderWithProviders(
    <AnswerHistoryPanel
      {...props}
      revisions={[
        revision(),
        revision({
          revisionid: 90,
          revision_no: 1,
          kind: 'create',
          prev: null,
          undoable: false,
          reason: 'Only the most recent change can be undone.',
        }),
      ]}
    />
  )

  // One action total, and it belongs to the newest row.
  expect(screen.getAllByRole('button', { name: /Undo/ })).toHaveLength(1)
  expect(
    screen.getByText('Only the most recent change can be undone.')
  ).toBeInTheDocument()
  // A create has no earlier side; the cell says so rather than rendering blank.
  expect(screen.getByText('No answer')).toBeInTheDocument()
})

it('disables the action while an undo is in flight', () => {
  renderWithProviders(<AnswerHistoryPanel {...props} isUndoing />)

  expect(
    screen.getByRole('button', { name: 'Undo last change' })
  ).toBeDisabled()
})

it('says so plainly when an answer has no recorded history', () => {
  renderWithProviders(<AnswerHistoryPanel {...props} revisions={[]} />)

  expect(
    screen.getByText(
      'No changes have been recorded for this answer in this data call.'
    )
  ).toBeInTheDocument()
})

it('renders its own error rather than leaving an empty panel', () => {
  renderWithProviders(
    <AnswerHistoryPanel {...props} revisions={[]} isError isPending={false} />
  )

  expect(screen.getByRole('alert')).toHaveTextContent(
    /Could not load this answer's history/
  )
})

/**
 * MUI renders the Drawer root with role="presentation", which strips
 * semantics, so aria-labelledby placed there is discarded and the panel
 * announces as nothing. Dialog applies both to its own Paper automatically;
 * Drawer does not. axe does not flag a missing dialog role on a custom panel,
 * so the frostfall gate cannot stand in for this.
 */
it('exposes dialog semantics and its accessible name', () => {
  renderWithProviders(<AnswerHistoryPanel {...props} />)

  const dialog = screen.getByRole('dialog')
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(dialog).toHaveAccessibleName('Answer history')
})

it('closes from the header control', () => {
  renderWithProviders(<AnswerHistoryPanel {...props} />)

  fireEvent.click(screen.getByRole('button', { name: 'Close answer history' }))
  expect(props.onClose).toHaveBeenCalled()
})

it('does not render its contents while closed', () => {
  renderWithProviders(<AnswerHistoryPanel {...props} open={false} />)

  expect(screen.queryByText('Answer history')).not.toBeInTheDocument()
})
