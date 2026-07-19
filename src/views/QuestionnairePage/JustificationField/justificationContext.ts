import type { InsightFinding, InsightPayload } from '@/types'

const cleanText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  return text.length ? text : undefined
}

const sentence = (value: string): string =>
  /[.!?]$/.test(value) ? value : `${value}.`

const findingCount = (value: unknown): number =>
  Array.isArray(value)
    ? value.filter(
        (finding): finding is InsightFinding =>
          !!finding && typeof finding === 'object'
      ).length
    : 0

const withScore = (label: string, score: unknown): string =>
  typeof score === 'number' ? `${label} (${score})` : label

/** Build the short, editable justification offered by ZTMF Insights. */
export function buildInsightJustification(
  payload?: InsightPayload
): string | undefined {
  if (!payload) return undefined

  for (const key of [
    'suggested_justification',
    'justification_summary',
    'insights_summary',
  ]) {
    const authored = cleanText(payload[key])
    if (authored) return authored
  }

  const parts: string[] = []
  const cfacts =
    cleanText(payload.cfacts_auth_methods) ??
    cleanText(payload.cfacts_reasoning)
  if (cfacts) {
    parts.push(
      sentence(
        `${withScore('CFACTS', payload.cfacts_suggested_score)}: ${cfacts}`
      )
    )
  }

  const kionCount = findingCount(payload.findings?.kion)
  if (kionCount > 0) {
    parts.push(
      `${withScore('Kion', payload.kion_suggested_score)}: ${kionCount} failing ${kionCount === 1 ? 'check' : 'checks'}.`
    )
  }
  const securityHubCount = findingCount(payload.findings?.sechub)
  if (securityHubCount > 0) {
    parts.push(
      `${withScore('SecurityHub', payload.sechub_suggested_score)}: ${securityHubCount} failing ${securityHubCount === 1 ? 'control' : 'controls'}.`
    )
  }
  const hardenizeCount = findingCount(payload.findings?.hardenize)
  if (hardenizeCount > 0) {
    parts.push(
      `${withScore('Hardenize', payload.hardenize_suggested_score)}: ${hardenizeCount} ${hardenizeCount === 1 ? 'finding' : 'findings'}.`
    )
  }
  if (typeof payload.ars_controls_total === 'number') {
    const satisfied =
      typeof payload.ars_controls_satisfied === 'number'
        ? payload.ars_controls_satisfied
        : 0
    parts.push(
      `${withScore('ARS', payload.ars_control_score)}: ${satisfied}/${payload.ars_controls_total} controls satisfied.`
    )
  }
  if (parts.length) return parts.join(' ')

  const suggested = cleanText(payload.suggested_label)
  const sources = cleanText(payload.evidence_sources)
  if (!suggested) return undefined
  return `ZTMF Insights suggests ${suggested}${
    typeof payload.suggested_score === 'number'
      ? ` (${payload.suggested_score})`
      : ''
  }${sources ? ` based on ${sources}` : ''}.`
}

const normalizeDatacall = (value?: string | null): string =>
  (value ?? '')
    .replace(/[_\s]+/g, ' ')
    .trim()
    .toLowerCase()

export function priorResponseFor(
  payload?: InsightPayload,
  viewedDatacall?: string
): { label: string; text: string } | undefined {
  const text = cleanText(payload?.last_score_notes)
  if (!text) return undefined
  const lastDatacall = cleanText(payload?.last_datacall)
  if (
    lastDatacall &&
    viewedDatacall &&
    normalizeDatacall(lastDatacall) === normalizeDatacall(viewedDatacall)
  ) {
    return undefined
  }
  return {
    label: lastDatacall
      ? `Last year's response — ${lastDatacall.replaceAll('_', ' ')}`
      : "Last year's ISSO response",
    text,
  }
}
