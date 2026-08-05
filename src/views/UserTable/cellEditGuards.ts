/**
 * Cell-level edit gates for the user grid, extracted so they can be tested
 * without standing up the grid. Defense in depth: the server enforces the same
 * rules, and these only decide whether a cell can enter edit mode.
 *
 * The opdivs gate is the load-bearing one. `processRowUpdate` writes OpDiv
 * grants only on the create path, so if an existing user's cell could be
 * edited the commit would report success and discard the change. Nothing else
 * prevents that, which is why this predicate is worth pinning.
 */

/** The row fields these gates read. */
export type EditableRow = {
  isNew?: boolean
  role?: string | null
}

/** Caller context the gates depend on. */
export type EditGuardContext = {
  /** Roles this admin may assign, from selectableRoles(callerRole). */
  assignableRoles: string[]
  /** Whether the IdP column is offered at all for this caller. */
  showIdpSelector: boolean
}

/**
 * Whether a given cell may enter edit mode.
 *
 * - `role`: editable on a new row, on a row with no role yet, or when the
 *   row's current role is inside the caller's assignable tier. Prevents an
 *   admin editing a role they could not otherwise grant.
 * - `opdivs`: new rows only. Existing users' memberships are changed through
 *   the Assign OpDivs action, which is the only path that persists them.
 * - `identity_provider`: new rows only, and only when the IdP column applies
 *   to this caller at all.
 * - anything else: editable, subject to the column's own `editable` flag.
 *
 * @param field - The column field key.
 * @param row - The row being edited.
 * @param ctx - Caller context (assignable roles, IdP visibility).
 * @returns True when the cell may enter edit mode.
 */
export function isUserCellEditable(
  field: string,
  row: EditableRow,
  ctx: EditGuardContext
): boolean {
  if (field === 'role') {
    return !!row.isNew || !row.role || ctx.assignableRoles.includes(row.role)
  }
  if (field === 'opdivs') {
    return !!row.isNew
  }
  if (field === 'identity_provider') {
    return !!row.isNew && ctx.showIdpSelector
  }
  return true
}
