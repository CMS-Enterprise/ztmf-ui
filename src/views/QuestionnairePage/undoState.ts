import type { CarryForwardState } from './confirmState'

/**
 * Whether the inline Undo button renders, alongside carryForwardState's
 * confirmation rules (ztmf-misc#392). Pure, and deliberately the same
 * single-object argument shape as canConfirmCarryForward, so the two
 * predicates read as a pair and can be tested against each other.
 *
 * The server owns the undo policy: it marks the head revision undoable or
 * not and supplies the reason string. This predicate only decides whether the
 * questionnaire's inline shortcut is offered, and never re-derives eligibility
 * the server already computed.
 */
export const canUndoAnswer = (s: {
  /** From the head revision's `undoable`; false when there is no history. */
  headUndoable: boolean
  state: CarryForwardState
  dirty: boolean
  isReadOnly: boolean
  /** scoreid !== 0 — an unanswered question has no row and no history. */
  hasScore: boolean
  priorReviewBlocked: boolean
}): boolean =>
  s.headUndoable &&
  // The load-bearing clause, and the reason this is not simply
  // !canConfirmCarryForward. Undoing the first edit of a carried-forward
  // answer returns status to not_started, which makes the chip read
  // "unconfirmed" and brings the Confirm button back — while the new head is
  // a kind='undo' revision the server still reports as undoable. Without this
  // clause both buttons would render at once. Requiring 'updated' also reads
  // correctly on its own: "Undo last change" only means something for an
  // answer that was changed this cycle, which is exactly when the chip says
  // "Updated this data call".
  //
  // Note this clause is now belt-and-braces rather than the only guard: the
  // server marks an undo head not-undoable outright (reasonIsUndo), so
  // headUndoable is already false in that case. It still earns its place for
  // the confirm path, where the head IS undoable and the chip would otherwise
  // offer Confirm and Undo together.
  s.state === 'updated' &&
  s.hasScore &&
  !s.dirty &&
  !s.isReadOnly &&
  !s.priorReviewBlocked

/**
 * The strip's button label. The head's kind decides it, because undoing a
 * confirm and undoing an edit are different acts to a reader even though they
 * are the same call.
 *
 * There is deliberately no 'undo' case: the server marks an undo head
 * not-undoable, so this is never asked to label one. Redo was removed because
 * undo appends rather than pops, so a repeatedly-clicked button would write a
 * run of revisions all describing the same two values.
 */
export const undoButtonLabel = (headKind: string | undefined): string =>
  headKind === 'confirm' ? 'Undo confirmation' : 'Undo last change'

/**
 * What the Undo button will do, for screen-reader users who otherwise get a
 * three-word label and no indication of the value it lands on.
 *
 * Built from the revision list rather than the head projection: the head
 * carries no sides, but `head.prev` is by definition the `new` side of the
 * revision before it, so the pair is already on the client. Returns undefined
 * when there is nothing useful to say, in which case the caller omits
 * aria-describedby entirely rather than pointing at empty text.
 */
export const undoPreview = (s: {
  /** The option the undo restores, from the head revision's prev side. */
  restoresOptionName?: string
  /** Whether that side carried a justification. */
  restoresNotes: boolean
  /** When that value was saved - the createdat of the revision before the head. */
  savedAt?: string
}): string | undefined => {
  if (!s.restoresOptionName) return undefined
  const when = s.savedAt ? new Date(s.savedAt) : undefined
  const saved =
    when && !isNaN(when.getTime())
      ? `, saved ${when.toLocaleDateString(undefined, { dateStyle: 'long' })}`
      : ''
  const justification = s.restoresNotes ? ' and its justification' : ''
  return `Restores the answer "${s.restoresOptionName}"${justification}${saved}.`
}
