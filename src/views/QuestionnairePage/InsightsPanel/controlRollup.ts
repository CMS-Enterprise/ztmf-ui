/**
 * Non-component logic shared by the Insights panel and its tests: payload text
 * coercion, severity chip styling, and the cross-source ARS control rollup.
 * Lives in its own module (not InsightsPanel.tsx) so the panel file only
 * exports components and Vite fast refresh keeps working.
 */
import type { InsightPayload } from '@/types'

// Coerce an opaque payload value to renderable text. The payload is untrusted
// JSON, so a field the type declares as a string could arrive as an object or
// array; rendering that directly throws "Objects are not valid as a React
// child" and (via the error boundary) blanks the whole panel. Coercing to a
// string degrades gracefully instead. Returns undefined for nullish/empty so
// existing truthiness guards still hide the element.
export function asText(v: unknown): string | undefined {
  if (v == null || v === '') return undefined
  return typeof v === 'string' ? v : String(v)
}

// Severity → chip color. error/high/critical = red, warning/medium = amber,
// everything else (low, powerup, unknown) = neutral.
export function severityStyle(sev?: string): { bg: string; fg: string } {
  const s = (sev ?? '').toLowerCase()
  if (s === 'error' || s === 'high' || s === 'critical')
    return { bg: '#fdecec', fg: '#b02a37' }
  if (s === 'warning' || s === 'warn' || s === 'medium')
    return { bg: '#fff4e5', fg: '#b26a00' }
  return { bg: '#f0f0f0', fg: '#666' }
}

// The state of one control in the ARS Controls rollup. `unsatisfied` = CFACTS says
// the control applies here but nothing has confirmed it satisfied (may be
// unassessed) — informational, not an alarm.
export type ControlRollupState = 'satisfied' | 'unsatisfied' | 'failing'

// One piece of evidence behind a control's state: which source spoke to it, the
// specific check (when the evidence is a finding-source check rather than a CFACTS
// coverage flag), and what that evidence said.
export type ControlEvidence = {
  source: string
  check?: string
  state: ControlRollupState
  // The check's human sentence, carried alongside the slug. A control chip is
  // labeled with the control id, so without this its hover would name the check
  // only by slug (`account-without-compliant-password-policy`) and the reader
  // would have to decode it — the check chips have shown this sentence since
  // they were introduced.
  description?: string
}

// A control after the cross-source rollup: its net (weakest-link) state, whether
// its sources disagree, and the full evidence list so the UI can name every source
// and show how a conflict resolved.
export type ControlRollup = {
  id: string
  state: ControlRollupState
  conflict: boolean
  evidence: ControlEvidence[]
}

// Weakest-link precedence for a control's NET state: failing beats satisfied beats
// unsatisfied. So a control is failing if ANY source fails it, else satisfied if
// ANY source passes it, else unsatisfied. Matches the zero-trust scoring principle
// (lowest signal wins).
const CONTROL_RANK: Record<ControlRollupState, number> = {
  failing: 3,
  satisfied: 2,
  unsatisfied: 1,
}

// Sources whose "passing" entries are inferred from the absence of a finding
// rather than observed as a pass. SecurityHub's vendor feed carries only FAILED
// records — it never emits a PASSED one — so `sechub_passing` is derived upstream
// as "mapped control with no active failure". That cannot distinguish "evaluated
// and passed" from "never scanned", so on a partially scanned system it would
// otherwise assert controls are met on the strength of checks that never ran.
// Consequently these entries still render as ✓ chips (the check is not failing)
// but are read as an absence of findings, and are withheld from the control
// rollup rather than counted as affirmative `satisfied` evidence.
//
// Remove a source from this set once its feed emits real passes; nothing else
// needs to change. Used by both the panel's feed blocks and rollupControls below.
export const INFERRED_PASS_SOURCES: ReadonlySet<string> = new Set(['sechub'])

// The ARS Controls total is the UNION of every ARS control any evidence source
// touches — CFACTS applicable/failing controls PLUS the NIST control each Kion,
// SecurityHub, and Hardenize check maps to. Each control keeps its full evidence
// list, nets to a weakest-link state, and is flagged `conflict` when at least one
// source passes it AND at least one source fails it (e.g. SC-12: Kion passes
// key-rotation but fails cross-account-access). This is why a control Kion passes
// appears here even though CFACTS never assessed it, and why a conflicted control
// can net to failing. The payload is opaque, so every value is coerced and
// guarded; a malformed element is skipped, never thrown.
export function rollupControls(
  payload: Partial<InsightPayload>
): ControlRollup[] {
  const map = new Map<string, ControlEvidence[]>()
  const add = (
    raw: unknown,
    source: string,
    state: ControlRollupState,
    check?: string,
    description?: string
  ) => {
    const text = asText(raw)
    if (!text) return
    // One check can map to several controls, e.g. "AC-2, AC-3".
    for (const part of text.split(',')) {
      const id = part.trim()
      if (!id) continue
      const list = map.get(id) ?? []
      list.push({
        source,
        state,
        check,
        // A title-only finding (no id, no description) resolves both the check
        // and the sentence to that same title. Drop the duplicate rather than
        // printing it twice in the hover and announcing it twice to AT.
        description: description === check ? undefined : description,
      })
      map.set(id, list)
    }
  }
  const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
  const finding = (f: unknown) =>
    f && typeof f === 'object'
      ? (f as {
          nist_controls?: unknown
          id?: unknown
          title?: unknown
          description?: unknown
        })
      : null
  // CFACTS assesses the ARS-framework controls (the ars_* fields carry CFACTS's
  // satisfied / applicable-but-not-satisfied / failing coverage). ARS is the
  // control catalog, not a source — CFACTS is the source of this coverage. These
  // arrays are plain control-id strings (unlike nist_controls, which may arrive as
  // an array and needs asText coercion), so filter to strings: a non-string
  // element would otherwise coerce to a junk chip ("42", "[object Object]").
  const isStr = (v: unknown): v is string => typeof v === 'string'
  // ars_not_satisfied is a SUPERSET of ars_failing — a failing control appears in
  // both. Subtract the failing ids so the control isn't listed twice in the hover
  // (once "not assessed", once "failed"); the net state is failing either way.
  const arsFailingIds = new Set(arr(payload.ars_failing_controls).filter(isStr))
  arr(payload.ars_satisfied_controls)
    .filter(isStr)
    .forEach((c) => add(c, 'CFACTS', 'satisfied'))
  arr(payload.ars_not_satisfied_controls)
    .filter(isStr)
    .filter((c) => !arsFailingIds.has(c))
    .forEach((c) => add(c, 'CFACTS', 'unsatisfied'))
  arr(payload.ars_failing_controls)
    .filter(isStr)
    .forEach((c) => add(c, 'CFACTS', 'failing'))
  // Finding-source checks: a passing check satisfies its control, a failing one (a
  // finding) fails it. Carry the check id/title so the hover can name it.
  const findings = (payload.findings ?? {}) as Record<string, unknown>
  const SRC_LABEL: Record<string, string> = {
    kion: 'Kion',
    sechub: 'SecurityHub',
    hardenize: 'Hardenize',
  }
  for (const src of ['kion', 'sechub', 'hardenize'] as const) {
    const label = SRC_LABEL[src]
    // An inferred pass is the absence of a finding, not evidence the control is
    // met — counting it as `satisfied` would flip a control from "not assessed"
    // to green on the strength of a check that may never have run.
    if (!INFERRED_PASS_SOURCES.has(src)) {
      arr((payload as Record<string, unknown>)[`${src}_passing`]).forEach(
        (f) => {
          const o = finding(f)
          add(
            o?.nist_controls,
            label,
            'satisfied',
            asText(o?.id) ?? asText(o?.title),
            // Kion puts the sentence in `description`, SecurityHub in `title` —
            // same fallback CheckTooltip uses, so both hovers read alike.
            asText(o?.description) ?? asText(o?.title)
          )
        }
      )
    }
    arr(findings[src]).forEach((f) => {
      const o = finding(f)
      add(
        o?.nist_controls,
        label,
        'failing',
        asText(o?.id) ?? asText(o?.title),
        asText(o?.description) ?? asText(o?.title)
      )
    })
  }
  return [...map.entries()].map(([id, evidence]) => {
    const state = evidence.reduce<ControlRollupState>(
      (net, e) => (CONTROL_RANK[e.state] > CONTROL_RANK[net] ? e.state : net),
      'unsatisfied'
    )
    const conflict =
      evidence.some((e) => e.state === 'satisfied') &&
      evidence.some((e) => e.state === 'failing')
    return { id, state, conflict, evidence }
  })
}
