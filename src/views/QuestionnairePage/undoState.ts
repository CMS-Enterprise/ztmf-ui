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
  // Consequence: redo of an undo that landed on not_started is not reachable
  // from the strip. It stays reachable from the history drawer, which renders
  // the head row's own action.
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
