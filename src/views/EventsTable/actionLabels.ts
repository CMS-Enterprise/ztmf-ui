// Event actions come back as bare lowercase verbs (created, updated, deleted,
// viewed, imported). Capitalize them for display; the raw value is still what
// the filter sends to the endpoint, which matches on the lowercase form.

/**
 * Maps an event's raw action verb to a display label (first letter
 * capitalized). Empty in, empty out.
 * @param {string} action - The raw action verb from the event row.
 * @returns {string} The capitalized label, or '' when the action is empty.
 */
export function actionLabel(action: string): string {
  if (!action) return ''
  return action.charAt(0).toUpperCase() + action.slice(1)
}
