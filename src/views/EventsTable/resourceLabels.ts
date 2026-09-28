// The events endpoint reports the resource as the raw database table the row
// touched (sometimes schema-qualified, e.g. "public.scores"). Those names leak
// storage detail into the audit view, so map the ones we know to plain nouns
// and prettify anything new rather than showing a bare table name.

const RESOURCE_LABELS: Record<string, string> = {
  scores: 'Score',
  users: 'User',
  // Join tables: a row is a single membership, not the table itself.
  users_fismasystems: 'System assignment',
  users_opdivs: 'OpDiv grant',
  fismasystems: 'System',
  opdivs: 'OpDiv',
  datacalls: 'Data call',
  systemattributes: 'System attribute',
  session: 'Session',
}

/**
 * Maps an event's raw resource type to a human-readable label. Strips any
 * schema qualifier ("public.scores" -> "scores") before the lookup, and falls
 * back to a prettified form (underscores to spaces, first letter capitalized)
 * for a table not in the map, so a newly-audited resource still reads cleanly.
 * @param {string} type - The raw resource type from the event row.
 * @returns {string} A friendly label, or '' when the type is empty.
 */
export function resourceLabel(type: string): string {
  if (!type) return ''
  const table = type.includes('.') ? type.split('.').pop() ?? type : type
  const known = RESOURCE_LABELS[table]
  if (known) return known
  const spaced = table.replace(/_/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
