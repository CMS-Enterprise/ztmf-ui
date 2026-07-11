import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import Collapse from '@mui/material/Collapse'
import Link from '@mui/material/Link'
import type {
  InsightPayload,
  InsightKionFinding,
  InsightSecHubFinding,
  InsightHardenizeFinding,
} from '@/types'

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
      key: 'ars',
      label: 'ARS',
      color: '#7c5cbf',
      score: p.ars_maturity ?? p.ars_control_score,
      active: p.ars_maturity != null || p.ars_controls_total != null,
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
  const kionFindings = Array.isArray(findings?.kion)
    ? (findings?.kion as InsightKionFinding[])
    : []
  const sechubFindings = Array.isArray(findings?.sechub)
    ? (findings?.sechub as InsightSecHubFinding[])
    : []
  const hardenizeFindings = Array.isArray(findings?.hardenize)
    ? (findings?.hardenize as InsightHardenizeFinding[])
    : []
  const hasFindings =
    kionFindings.length > 0 ||
    sechubFindings.length > 0 ||
    hardenizeFindings.length > 0
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
              {payload.evidence_sources}
            </Typography>
          )}

          {payload.cfacts_reasoning && (
            <Typography sx={{ fontSize: 12, color: '#555', mb: 0.75 }}>
              <Box component="span" sx={{ fontWeight: 600, color: '#333' }}>
                CFACTS:
              </Box>{' '}
              {payload.cfacts_reasoning}
            </Typography>
          )}

          {payload.ars_controls_total != null && (
            <Typography sx={{ fontSize: 12, color: '#555', mb: 0.75 }}>
              <Box component="span" sx={{ fontWeight: 600, color: '#333' }}>
                ARS Controls:
              </Box>{' '}
              {payload.ars_controls_satisfied ?? 0} of{' '}
              {payload.ars_controls_total} satisfied
            </Typography>
          )}

          {kionFindings.map((f, i) => (
            <FindingRow
              key={`kion-${f.id ?? i}`}
              source="Kion"
              title={f.id}
              description={f.description}
              remediation={f.remediation}
              nistControls={f.nist_controls}
            />
          ))}
          {sechubFindings.map((f, i) => (
            <FindingRow
              key={`sechub-${f.id ?? i}`}
              source="SecurityHub"
              title={f.id}
              severity={f.severity}
              description={f.title ?? f.description}
              remediation={f.remediation}
            />
          ))}
          {hardenizeFindings.map((f, i) => (
            <FindingRow
              key={`hardenize-${f.id ?? i}`}
              source="Hardenize"
              title={f.id}
              severity={f.severity}
              description={f.title}
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

function FindingRow({
  source,
  title,
  severity,
  description,
  remediation,
  nistControls,
}: {
  source: string
  title?: string
  severity?: string
  description?: string
  remediation?: string
  nistControls?: string
}) {
  return (
    <Box sx={{ fontSize: 12, color: '#555', mb: 0.75, lineHeight: 1.6 }}>
      <Box component="span" sx={{ fontWeight: 700, color: '#333' }}>
        {source}
      </Box>
      {title && (
        <Box
          component="span"
          sx={{
            ml: 0.75,
            fontFamily: 'monospace',
            fontSize: 11,
            color: '#9a6700',
          }}
        >
          {title}
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
            bgcolor: '#f0f0f0',
            color: '#666',
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
      {description && <Box sx={{ mt: 0.25, color: '#666' }}>{description}</Box>}
      {remediation && (
        <Box sx={{ mt: 0.25, color: '#5a6a8a' }}>
          <Box component="span" sx={{ fontWeight: 600 }}>
            Fix:
          </Box>{' '}
          {remediation}
        </Box>
      )}
    </Box>
  )
}
