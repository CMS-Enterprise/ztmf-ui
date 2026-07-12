import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import Collapse from '@mui/material/Collapse'
import Link from '@mui/material/Link'
import type { InsightPayload, InsightFinding } from '@/types'

type Props = {
  payload: InsightPayload
}

// ZTMF maturity levels. The pipeline sends numeric scores; labels come with
// the payload where available, but we fall back to this map for the pill and
// per-source chips so a missing label never renders a bare number.
const MATURITY_LABEL: Record<number, string> = {
  1: 'Traditional',
  2: 'Initial',
  3: 'Advanced',
  4: 'Optimal',
}

function maturityLabel(score?: number | null): string | null {
  if (score == null) return null
  return MATURITY_LABEL[score] ?? null
}

// Suggested-pill tint keyed by score. Mirrors the prototype's trad/init/adv/opt
// palette. Unknown/blank score renders neutral.
const SUGGESTED_TINT: Record<number, { bg: string; fg: string }> = {
  1: { bg: '#fff3e0', fg: '#a86500' },
  2: { bg: '#fff8e1', fg: '#7d6608' },
  3: { bg: '#e8eef5', fg: '#2c5282' },
  4: { bg: '#e3f2fd', fg: '#0d47a1' },
}

type SourceConfig = {
  key: string
  label: string
  color: string
  score?: number | null
  active: boolean
}

// Order and brand colors match the enrichment prototype. `active` decides the
// solid vs greyed chip; it is derived from the source's own availability flag /
// key presence rather than assuming every source contributed.
function buildSources(p: InsightPayload): SourceConfig[] {
  return [
    {
      key: 'kion',
      label: 'Kion',
      color: '#e86c25',
      score: p.kion_suggested_score,
      active: p.has_kion_data === true || p.kion_suggested_score != null,
    },
    {
      key: 'sechub',
      label: 'SecurityHub',
      color: '#3a7ca5',
      score: p.sechub_suggested_score,
      active: p.has_sechub_data === true || p.sechub_suggested_score != null,
    },
    {
      key: 'hardenize',
      label: 'Hardenize',
      color: '#b0651e',
      score: p.hardenize_suggested_score,
      active:
        p.has_hardenize_data === true || p.hardenize_suggested_score != null,
    },
    {
      key: 'cfacts',
      label: 'CFACTS',
      color: '#0071bc',
      score: p.cfacts_suggested_score,
      active: p.cfacts_suggested_score != null || p.cfacts_auth_methods != null,
    },
    {
      // ARS dot shows the numeric maturity score (ars_control_score, 1-4) —
      // NOT ars_maturity (the string label like "Initial", which won't fit the
      // dot) and NOT the controls-satisfied count (which is coverage, not
      // maturity: 4/4 controls can still be Initial=2). The label is surfaced in
      // the chip tooltip via maturityLabel(score).
      key: 'ars',
      label: 'ARS',
      color: '#7c5cbf',
      score: p.ars_control_score,
      active: p.ars_control_score != null || p.ars_controls_total != null,
    },
  ]
}

// A source is the "floor" (drove the suggestion) when score_floor_source names
// it. The backend sends free text like "Hardenize (failing TLS remarks)", so we
// match on the label appearing in that string.
function isFloor(floorSource: string | null | undefined, label: string) {
  if (!floorSource) return false
  return floorSource.toLowerCase().includes(label.toLowerCase())
}

function ScoreDot({
  score,
  color,
  active,
}: {
  score?: number | null
  color: string
  active: boolean
}) {
  return (
    <Box
      component="span"
      sx={{
        width: 16,
        height: 16,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 9,
        fontWeight: 700,
        color: '#fff',
        lineHeight: 1,
        flexShrink: 0,
        bgcolor: active ? color : '#ccc',
      }}
    >
      {score != null ? score : '–'}
    </Box>
  )
}

function SourceChip({ src, floor }: { src: SourceConfig; floor: boolean }) {
  const title = src.active
    ? `${src.label}${src.score != null ? `: ${maturityLabel(src.score) ?? `Score ${src.score}`}` : ''}${
        floor ? ' — drives the suggested score' : ''
      }`
    : `${src.label}: no data for this system`

  return (
    <Tooltip title={title} placement="top" arrow>
      <Box
        component="span"
        aria-label={title}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          pl: 0.5,
          pr: 1,
          py: 0.25,
          borderRadius: '12px',
          fontSize: 11,
          fontWeight: 600,
          bgcolor: floor ? '#fffdf5' : '#fff',
          border: floor ? '1.5px solid #b08d00' : '1px solid #ddd',
          color: floor ? '#7d6608' : src.active ? '#333' : '#888',
          opacity: src.active ? 1 : 0.4,
        }}
      >
        <ScoreDot score={src.score} color={src.color} active={src.active} />
        <Box component="span">{src.label}</Box>
      </Box>
    </Tooltip>
  )
}

// Normalize a data-call name for comparison: fold underscores/whitespace and
// case so "FY2025_Q3" (the viewed call slug) matches "FY2025 Q3" (the payload's
// label form).
function sameDatacall(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false
  const norm = (s: string) =>
    s
      .replace(/[_\s]+/g, ' ')
      .trim()
      .toLowerCase()
  return norm(a) === norm(b)
}

// Inline badges for a single answer option, matched by maturity score against
// the question's insight. Rendered next to the option label in the radio group
// so a scorer sees, at the point of choosing, which answer the evidence points
// to and which answer they gave last cycle.
export function OptionInsightBadges({
  score,
  insight,
  viewedDatacall,
}: {
  score?: number
  insight?: InsightPayload
  // The data call currently being viewed. The prior-answer badge is only
  // meaningful when the insight's last answer is from an EARLIER call; if the
  // insight's last_datacall is the call on screen, the badge would label the
  // current call as "prior", so it is suppressed.
  viewedDatacall?: string
}) {
  if (!insight || score == null) return null
  const isSuggested =
    insight.suggested_score != null && score === insight.suggested_score
  const isPrior =
    insight.last_score != null &&
    score === insight.last_score &&
    !sameDatacall(insight.last_datacall, viewedDatacall)
  if (!isSuggested && !isPrior) return null

  const priorLabel = insight.last_datacall
    ? `${String(insight.last_datacall).replaceAll('_', ' ')} answer`
    : "Last year's answer"

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        gap: 0.5,
        ml: 0.75,
        verticalAlign: 'middle',
      }}
    >
      {isSuggested && (
        <Box
          component="span"
          sx={{
            px: 0.75,
            py: 0.125,
            borderRadius: '4px',
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.3px',
            color: '#2c5282',
            bgcolor: '#eaf1fb',
            border: '1px dashed #5666b8',
            whiteSpace: 'nowrap',
          }}
        >
          ZTMF Insights
        </Box>
      )}
      {isPrior && (
        <Box
          component="span"
          sx={{
            px: 0.75,
            py: 0.125,
            borderRadius: '4px',
            fontSize: 10,
            fontWeight: 600,
            color: '#555',
            bgcolor: '#f0f0f0',
            border: '1px solid #ddd',
            whiteSpace: 'nowrap',
          }}
        >
          {priorLabel}
        </Box>
      )}
    </Box>
  )
}

function InsightsPanelInner({ payload }: Props) {
  const [open, setOpen] = React.useState(false)

  // Parent already gates on payload presence, but guard so the component is
  // safe to render defensively anywhere.
  if (!payload) return null

  const sources = buildSources(payload)
  const suggestedScore = payload.suggested_score
  const suggestedLabel =
    payload.suggested_label ?? maturityLabel(suggestedScore)
  const tint =
    suggestedScore != null ? SUGGESTED_TINT[suggestedScore] : undefined
  // "Confirmed" when the suggestion matches the prior self-reported score.
  const confirmed =
    suggestedScore != null &&
    payload.last_score != null &&
    suggestedScore === payload.last_score
  const suggestedText =
    suggestedScore != null
      ? `${confirmed ? 'Confirmed' : 'Suggested'}: ${suggestedLabel ?? `Score ${suggestedScore}`}${
          suggestedScore != null ? ` (${suggestedScore})` : ''
        }`
      : 'No suggestion'

  // The payload is opaque/additive, so a sub-field the type declares as an
  // array could arrive as something else. Coerce to real arrays before mapping
  // so a malformed findings block degrades to "no findings" instead of throwing
  // during render (which the route errorElement would turn into a full-page
  // error for the whole questionnaire).
  const findings = payload.findings
  const asFindingArray = (v: unknown): InsightFinding[] =>
    Array.isArray(v) ? (v as InsightFinding[]) : []
  const kionFindings = asFindingArray(findings?.kion)
  const sechubFindings = asFindingArray(findings?.sechub)
  const hardenizeFindings = asFindingArray(findings?.hardenize)
  const hasFindings =
    kionFindings.length > 0 ||
    sechubFindings.length > 0 ||
    hardenizeFindings.length > 0
  // ARS control IDs behind the counts. Optional/additive — undefined, null, or
  // [] until the pipeline emits them; render only when non-empty. The payload is
  // opaque, so filter to strings: a non-string element would otherwise render as
  // a React child and throw, blanking the whole panel via the boundary.
  const toStringArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((c): c is string => typeof c === 'string') : []
  const arsSatisfied = toStringArray(payload.ars_satisfied_controls)
  const arsFailing = toStringArray(payload.ars_failing_controls)
  const hasDetail =
    hasFindings ||
    !!payload.cfacts_reasoning ||
    !!payload.ars_controls_total ||
    !!payload.evidence_sources

  return (
    <Box
      sx={{
        bgcolor: '#f8f9fe',
        border: '1px solid #d8dce8',
        borderLeft: '4px solid',
        borderLeftColor: '#5666b8',
        borderRadius: '6px',
        p: '14px 18px',
        my: 2,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          flexWrap: 'wrap',
        }}
      >
        <Typography
          component="span"
          sx={{
            fontSize: 12,
            fontWeight: 700,
            color: '#5666b8',
            flexShrink: 0,
          }}
        >
          ZTMF Insights
        </Typography>

        <Box sx={{ display: 'flex', gap: 0.625, flexWrap: 'wrap' }}>
          {sources.map((src) => (
            <SourceChip
              key={src.key}
              src={src}
              floor={isFloor(payload.score_floor_source, src.label)}
            />
          ))}
        </Box>

        <Box
          component="span"
          sx={{
            ml: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            px: 1.5,
            py: 0.375,
            borderRadius: '4px',
            fontSize: 12,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            bgcolor: tint?.bg ?? '#eeeeee',
            color: tint?.fg ?? '#555',
          }}
        >
          {suggestedText}
        </Box>

        {hasDetail && (
          <Link
            component="button"
            type="button"
            onClick={() => setOpen((v) => !v)}
            sx={{ fontSize: 11, color: '#5666b8', flexShrink: 0 }}
          >
            {open ? 'hide' : 'details'}
          </Link>
        )}
      </Box>

      <Collapse in={open} unmountOnExit>
        <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid #e0e4f0' }}>
          {payload.evidence_sources && (
            <Typography sx={{ fontSize: 12, color: '#555', mb: 0.75 }}>
              <Box component="span" sx={{ fontWeight: 600, color: '#333' }}>
                Based on:
              </Box>{' '}
              {asText(payload.evidence_sources)}
            </Typography>
          )}

          {payload.cfacts_reasoning && (
            <Typography sx={{ fontSize: 12, color: '#555', mb: 0.75 }}>
              <Box component="span" sx={{ fontWeight: 600, color: '#333' }}>
                CFACTS:
              </Box>{' '}
              {asText(payload.cfacts_reasoning)}
            </Typography>
          )}

          {payload.ars_controls_total != null && (
            <Box sx={{ mb: 0.75 }}>
              <Typography sx={{ fontSize: 12, color: '#555' }}>
                <Box component="span" sx={{ fontWeight: 600, color: '#333' }}>
                  ARS Controls:
                </Box>{' '}
                {asText(payload.ars_controls_satisfied) ?? 0} of{' '}
                {asText(payload.ars_controls_total)} satisfied
              </Typography>
              {(arsSatisfied.length > 0 || arsFailing.length > 0) && (
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 0.5,
                    mt: 0.5,
                  }}
                >
                  {arsSatisfied.map((id, i) => (
                    <ControlChip key={`sat-${id}-${i}`} id={id} passed />
                  ))}
                  {arsFailing.map((id, i) => (
                    <ControlChip
                      key={`fail-${id}-${i}`}
                      id={id}
                      passed={false}
                    />
                  ))}
                </Box>
              )}
            </Box>
          )}

          {kionFindings.map((f, i) => (
            <FindingRow key={`kion-${f.id ?? i}`} source="Kion" finding={f} />
          ))}
          {sechubFindings.map((f, i) => (
            <FindingRow
              key={`sechub-${f.id ?? i}`}
              source="SecurityHub"
              finding={f}
            />
          ))}
          {hardenizeFindings.map((f, i) => (
            <FindingRow
              key={`hardenize-${f.id ?? i}`}
              source="Hardenize"
              finding={f}
            />
          ))}
        </Box>
      </Collapse>
    </Box>
  )
}

// Error boundary around the panel: a render throw (e.g. an opaque payload field
// arriving in an unexpected shape) degrades to rendering nothing instead of
// bubbling to the route's errorElement and replacing the entire questionnaire
// with an error page. The panel is purely additive — failing to render it must
// never take down the page.
class InsightPanelBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? null : <>{this.props.children}</>
  }
}

export default function InsightsPanel(props: Props) {
  return (
    <InsightPanelBoundary>
      <InsightsPanelInner {...props} />
    </InsightPanelBoundary>
  )
}

// A single ARS control ID pill — green when satisfied, red when failing.
function ControlChip({ id, passed }: { id: string; passed: boolean }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.375,
        px: 0.75,
        py: 0.125,
        borderRadius: '4px',
        fontSize: 10,
        fontWeight: 600,
        fontFamily: 'monospace',
        whiteSpace: 'nowrap',
        bgcolor: passed ? '#e6f4ea' : '#fdecec',
        color: passed ? '#1e7e34' : '#b02a37',
        border: passed ? '1px solid #b7dfc2' : '1px solid #f1b0b0',
      }}
    >
      <Box component="span">{passed ? '✓' : '✗'}</Box>
      {id}
    </Box>
  )
}

// Coerce an opaque payload value to renderable text. The payload is untrusted
// JSON, so a field the type declares as a string could arrive as an object or
// array; rendering that directly throws "Objects are not valid as a React
// child" and (via the error boundary) blanks the whole panel. Coercing to a
// string degrades gracefully instead. Returns undefined for nullish/empty so
// existing truthiness guards still hide the element.
function asText(v: unknown): string | undefined {
  if (v == null || v === '') return undefined
  return typeof v === 'string' ? v : String(v)
}

// Hardenize instance `detail` is inconsistent — a stringified JSON object
// ({"Error message":"..."}), plain text ("Dangling DNS record: ..."), or empty
// ({}). Surface something readable: JSON objects → their values joined; plain
// text as-is; empty → nothing.
function formatHardenizeDetail(detail?: string): string | undefined {
  const t = asText(detail)
  if (!t || t === '{}') return undefined
  try {
    const parsed = JSON.parse(t)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const vals = Object.values(parsed).map(String).filter(Boolean)
      return vals.length ? vals.join('; ') : undefined
    }
  } catch {
    /* not JSON — fall through to raw text */
  }
  return t
}

// Severity → chip color. error/high/critical = red, warning/medium = amber,
// everything else (low, powerup, unknown) = neutral.
function severityStyle(sev?: string): { bg: string; fg: string } {
  const s = (sev ?? '').toLowerCase()
  if (s === 'error' || s === 'high' || s === 'critical')
    return { bg: '#fdecec', fg: '#b02a37' }
  if (s === 'warning' || s === 'warn' || s === 'medium')
    return { bg: '#fff4e5', fg: '#b26a00' }
  return { bg: '#f0f0f0', fg: '#666' }
}

// One structured finding, uniform across sources. Card = id (code) + title +
// severity + description; "How to fix" when remediation is present; a hover
// "N domains" affordance for Hardenize instances. Every field is optional and
// coerced to text, so a null/malformed field degrades instead of throwing.
function FindingRow({
  source,
  finding,
}: {
  source: string
  finding: InsightFinding
}) {
  const code = asText(finding.id)
  const heading = asText(finding.title)
  const severity = asText(finding.severity)
  const sevStyle = severityStyle(severity)
  const description = asText(finding.description)
  const remediation = asText(finding.remediation)
  const nistControls = asText(finding.nist_controls)
  // Affected hosts (Hardenize). domain is required; detail is optional.
  const domains = (Array.isArray(finding.instances) ? finding.instances : [])
    .map((inst) => ({
      domain: asText(inst?.domain),
      detail: formatHardenizeDetail(inst?.detail),
    }))
    .filter((d) => d.domain)
  const domainsTooltip =
    domains.length > 0 ? (
      <Box sx={{ py: 0.25 }}>
        {domains.map((d, i) => (
          <Box key={`${d.domain}-${i}`} sx={{ fontSize: 11, lineHeight: 1.5 }}>
            {d.domain}
            {d.detail ? ` — ${d.detail}` : ''}
          </Box>
        ))}
      </Box>
    ) : null
  return (
    <Box sx={{ fontSize: 12, color: '#555', mb: 0.75, lineHeight: 1.6 }}>
      <Box component="span" sx={{ fontWeight: 700, color: '#333' }}>
        {source}
      </Box>
      {code && (
        <Box
          component="span"
          sx={{
            ml: 0.75,
            fontFamily: 'monospace',
            fontSize: 11,
            color: '#9a6700',
          }}
        >
          {code}
        </Box>
      )}
      {heading && (
        <Box component="span" sx={{ ml: 0.75, color: '#333' }}>
          {heading}
        </Box>
      )}
      {severity && (
        <Box
          component="span"
          sx={{
            ml: 0.75,
            px: 0.75,
            py: 0.125,
            borderRadius: '3px',
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            bgcolor: sevStyle.bg,
            color: sevStyle.fg,
          }}
        >
          {severity}
        </Box>
      )}
      {nistControls && (
        <Box
          component="span"
          sx={{
            ml: 0.75,
            px: 0.75,
            py: 0.125,
            borderRadius: '3px',
            fontSize: 10,
            fontWeight: 600,
            bgcolor: '#e8eef5',
            color: '#2c5282',
          }}
        >
          {nistControls}
        </Box>
      )}
      {domainsTooltip && (
        <Tooltip title={domainsTooltip} placement="top" arrow>
          <Box
            component="span"
            aria-label={domains.map((d) => d.domain).join(', ')}
            sx={{
              ml: 0.75,
              px: 0.75,
              py: 0.125,
              borderRadius: '3px',
              fontSize: 10,
              fontWeight: 600,
              bgcolor: '#eef2f8',
              color: '#3a5a80',
              cursor: 'default',
              borderBottom: '1px dotted #7a94b8',
            }}
          >
            {domains.length} domain{domains.length === 1 ? '' : 's'}
          </Box>
        </Tooltip>
      )}
      {description && <Box sx={{ mt: 0.25, color: '#666' }}>{description}</Box>}
      {remediation && (
        <Box sx={{ mt: 0.25, color: '#5a6a8a' }}>
          <Box component="span" sx={{ fontWeight: 600 }}>
            How to fix:
          </Box>{' '}
          {remediation}
        </Box>
      )}
    </Box>
  )
}
