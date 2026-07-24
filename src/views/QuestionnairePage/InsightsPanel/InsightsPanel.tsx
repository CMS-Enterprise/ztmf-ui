import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import Collapse from '@mui/material/Collapse'
import Link from '@mui/material/Link'
import type { InsightPayload, InsightFinding } from '@/types'
import CONFIG from '@/utils/config'
import {
  fipsBadgeText,
  showFipsStrip,
  baselineCeiling,
  asImpactLevel,
  FIPS_GOLD,
} from '../fipsBaseline'

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
  // Chip order MUST match the drawer's section order (below). Kion sits last — it
  // usually has the most checks — with SecurityHub second-to-last; CFACTS leads
  // because its ARS-control coverage renders first in the drawer.
  return [
    {
      // CFACTS is the source that assesses the ARS-framework controls, so its chip
      // subsumes the old standalone "ARS" chip: it's active and scored off EITHER
      // the CFACTS reasoning fields OR the ARS control-coverage fields. ARS itself
      // is the control catalog (the "ARS Controls" section), not a source chip.
      key: 'cfacts',
      label: 'CFACTS',
      color: '#0071bc',
      score: p.cfacts_suggested_score ?? p.ars_control_score,
      active:
        p.cfacts_suggested_score != null ||
        p.cfacts_auth_methods != null ||
        p.cfacts_reasoning != null ||
        p.ars_control_score != null ||
        p.ars_controls_total != null,
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
      key: 'sechub',
      label: 'SecurityHub',
      color: '#3a7ca5',
      score: p.sechub_suggested_score,
      active: p.has_sechub_data === true || p.sechub_suggested_score != null,
    },
    {
      key: 'kion',
      label: 'Kion',
      color: '#e86c25',
      score: p.kion_suggested_score,
      active: p.has_kion_data === true || p.kion_suggested_score != null,
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

// Score badge inside a source chip. Shows the maturity WORD ("Initial"), not the
// bare number — a numeric badge next to a source name reads as a finding count
// ("2 findings") rather than the maturity tier it is. Fixed width so every badge
// is the same size, wide enough for the longest label ("Traditional").
function ScoreBadge({
  score,
  color,
  active,
}: {
  score?: number | null
  color: string
  active: boolean
}) {
  const label = active
    ? maturityLabel(score) ?? (score != null ? `Score ${score}` : '—')
    : '—'
  return (
    <Box
      component="span"
      sx={{
        width: 74,
        height: 16,
        borderRadius: '8px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: '0.2px',
        color: '#fff',
        lineHeight: 1,
        flexShrink: 0,
        // Inactive badge uses a mid grey (not #ccc) so the white "—" clears
        // WCAG AA (4.5:1) — #ccc failed at ~1.6:1.
        bgcolor: active ? color : '#6c757d',
      }}
    >
      {label}
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
          pl: 1,
          pr: 0.5,
          py: 0.25,
          borderRadius: '12px',
          fontSize: 11,
          fontWeight: 600,
          bgcolor: floor ? '#fffdf5' : '#fff',
          border: floor ? '1.5px solid #b08d00' : '1px solid #ddd',
          // Inactive label a compliant mid grey at full opacity — the old
          // #888 @ 0.4 opacity blended to ~3:1 on white and failed AA.
          color: floor ? '#7d6608' : src.active ? '#333' : '#595959',
        }}
      >
        <Box component="span">{src.label}:</Box>
        <ScoreBadge score={src.score} color={src.color} active={src.active} />
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
        <Tooltip
          title="The answer the automated evidence points to"
          placement="top"
          arrow
        >
          <Box
            component="span"
            aria-label="ZTMF Insights — the answer the automated evidence points to"
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
              cursor: 'help',
            }}
          >
            ZTMF Insights
          </Box>
        </Tooltip>
      )}
      {isPrior && (
        <Tooltip
          title="The answer you gave in a prior data call"
          placement="top"
          arrow
        >
          <Box
            component="span"
            aria-label={`${priorLabel} — the answer you gave in a prior data call`}
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
              cursor: 'help',
            }}
          >
            {priorLabel}
          </Box>
        </Tooltip>
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
  // "Based on" is derived from the active source chips, NOT the backend
  // evidence_sources string — that string still lists "ARS", which is the control
  // catalog, not a source. Deriving keeps the line consistent with the chip row.
  const basedOnSources = sources.filter((s) => s.active).map((s) => s.label)
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
  // ARS Controls is the UNION of every control any source touches (CFACTS +
  // per-check NIST mappings from Kion/SecurityHub/Hardenize), each rolled up to a
  // single state by weakest-link. Split into the three render buckets, ordered
  // satisfied → not-satisfied → failing so a flagged control renders once, in its
  // most-severe state. Additive/opaque-safe: empty until sources emit controls.
  const controls = rollupControls(payload)
  const controlsSatisfied = controls.filter((c) => c.state === 'satisfied')
  const controlsUnsatisfied = controls.filter((c) => c.state === 'unsatisfied')
  const controlsFailing = controls.filter((c) => c.state === 'failing')
  const controlsTotal = controls.length

  // Per-source pass/fail. A finding = a FAILED check (failing side, `findings`);
  // the PASSING side ships separately as `{source}_passing` (same InsightFinding
  // shape + level). When a source ships its passing array we render an ARS-style
  // pass/fail block ("N of M checks passed" + ✓/✗ chips); until then it falls
  // back to the plain failing FindingRows. Generic over all three finding-sources
  // — Kion is live, sechub/hardenize light up when their arrays land, no code
  // change. `hasPassing` keys on the array being PRESENT (even empty) so an
  // all-failing source with a shipped passing array still reads "0 of M".
  // Feed section order matches the chip order: Hardenize, SecurityHub, Kion — Kion
  // last because it usually has the most checks.
  const feedSources = (
    [
      { key: 'hardenize', label: 'Hardenize', failing: hardenizeFindings },
      { key: 'sechub', label: 'SecurityHub', failing: sechubFindings },
      { key: 'kion', label: 'Kion', failing: kionFindings },
    ] as const
  ).map((s) => {
    const raw = payload[`${s.key}_passing`]
    return {
      ...s,
      passing: asFindingArray(raw),
      hasPassing: Array.isArray(raw),
    }
  })
  const anyFeedBlock = feedSources.some((s) => s.hasPassing)

  // Every source chip that carries data must have a matching section explaining its
  // score — a scored chip with no section reads as "passed, but no reason why".
  // Hardenize renders a section whenever it has data (even clean, where the reason
  // IS the absence of failures); CFACTS renders its reasoning/auth (or, failing
  // that, its score) whenever it has any of its own signal.
  const hardenizeActive =
    payload.has_hardenize_data === true ||
    payload.hardenize_suggested_score != null
  // The CFACTS chip scores off cfacts_suggested_score ?? ars_control_score, so the
  // section falls back the same way — but only to ars_control_score when there's no
  // ARS Controls section (controlsTotal === 0) to already serve as the reason.
  // Otherwise a scored CFACTS chip could have no matching section at all.
  const cfactsScore =
    payload.cfacts_suggested_score ?? payload.ars_control_score
  const cfactsText =
    [asText(payload.cfacts_reasoning), asText(payload.cfacts_auth_methods)]
      .filter(Boolean)
      .join(' · ') ||
    (payload.cfacts_suggested_score != null ||
    (controlsTotal === 0 && cfactsScore != null)
      ? `scored ${maturityLabel(cfactsScore) ?? `Score ${cfactsScore}`}`
      : undefined)

  const hasDetail =
    hasFindings ||
    anyFeedBlock ||
    hardenizeActive ||
    !!cfactsText ||
    controlsTotal > 0 ||
    basedOnSources.length > 0

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
      {/* FIPS baseline strip — lives at the top of the insights panel so it's
          gated on insight data like everything else here (no insight → no
          panel → no strip). Only shown when there's headroom above the
          baseline (ceiling < 4). */}
      {showFipsStrip(
        asImpactLevel(payload.fips_impact_level),
        payload.fips_ceiling
      ) && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            bgcolor: FIPS_GOLD.box,
            border: `1px solid ${FIPS_GOLD.border}`,
            borderRadius: '6px',
            p: '8px 14px',
            mb: 1.5,
            fontSize: 12,
          }}
        >
          <Tooltip
            title={`FIPS impact level for this system: ${payload.fips_impact_level}`}
            placement="top"
            arrow
          >
            <Box
              component="span"
              tabIndex={0}
              aria-label={`FIPS impact level: ${payload.fips_impact_level}`}
              sx={{
                fontSize: 11,
                fontWeight: 700,
                bgcolor: FIPS_GOLD.badgeBg,
                color: FIPS_GOLD.badgeText,
                px: 1,
                py: 0.25,
                borderRadius: '3px',
                letterSpacing: '0.3px',
                flexShrink: 0,
                cursor: 'help',
              }}
            >
              {fipsBadgeText(asImpactLevel(payload.fips_impact_level))}
            </Box>
          </Tooltip>
          <Box
            component="span"
            sx={{ color: FIPS_GOLD.text, flex: 1, lineHeight: 1.5 }}
          >
            Baseline for this system is{' '}
            <Box
              component="span"
              sx={{ fontWeight: 700, color: FIPS_GOLD.strong }}
            >
              {maturityLabel(baselineCeiling(payload.fips_ceiling))}
            </Box>
            . Higher maturity levels are available — teams that go above
            baseline are encouraged to document what&rsquo;s driving that
            maturity.
          </Box>
        </Box>
      )}

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
          {/* ARS Controls — the cross-source control TOTAL: the union of every
              control any evidence source touches (CFACTS coverage + the NIST
              control each Kion / SecurityHub / Hardenize check maps to), each
              rolled up weakest-link. Leads the drawer as the richest signal. A
              control Kion passes (e.g. SC-12) shows satisfied here even if CFACTS
              never assessed it — this row is the total, not CFACTS alone. */}
          {controlsTotal > 0 && (
            <Box sx={{ mb: 0.75 }}>
              <Typography sx={{ fontSize: 12, color: '#555' }}>
                <Box component="span" sx={{ fontWeight: 600, color: '#333' }}>
                  ARS Controls:
                </Box>{' '}
                {controlsSatisfied.length} of {controlsTotal} satisfied
              </Typography>
              <Box
                sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}
              >
                {[
                  ...controlsSatisfied,
                  ...controlsUnsatisfied,
                  ...controlsFailing,
                ].map((c, i) => (
                  <ControlChip
                    key={`${c.state}-${c.id}-${i}`}
                    id={c.id}
                    variant={c.conflict ? 'conflict' : c.state}
                    tooltip={<ControlTooltip control={c} />}
                    ariaLabel={controlAriaLabel(c)}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* CFACTS — its own section, distinct from the ARS Controls total. Shown
              whenever CFACTS has any of its own signal (reasoning, auth methods, or
              a score) so a scored CFACTS chip always has a matching "why". */}
          {cfactsText && (
            <Typography sx={{ fontSize: 12, color: '#555', mb: 0.75 }}>
              <Box component="span" sx={{ fontWeight: 600, color: '#333' }}>
                CFACTS:
              </Box>{' '}
              {cfactsText}
            </Typography>
          )}

          {basedOnSources.length > 0 && (
            <Typography sx={{ fontSize: 12, color: '#555', mb: 0.75 }}>
              <Box component="span" sx={{ fontWeight: 600, color: '#333' }}>
                Based on:
              </Box>{' '}
              {basedOnSources.join(', ')}
            </Typography>
          )}

          {feedSources.map((s) => {
            // Kion and SecurityHub render as the compact chip block (finding-name
            // chips, ✓/✗). Hardenize keeps the richer FindingRow (affected domains)
            // for its failing findings.
            const asBlock =
              s.hasPassing || s.key === 'kion' || s.key === 'sechub'
            if (asBlock) {
              return s.hasPassing || s.failing.length > 0 ? (
                <FeedCheckBlock
                  key={`feed-${s.key}`}
                  label={s.label}
                  passing={s.passing}
                  failing={s.failing}
                  hasPassing={s.hasPassing}
                />
              ) : null
            }
            // Hardenize (the only non-block source): a scored chip must have a
            // section. Failing findings render as rows (with affected domains).
            // When there are none but the source has data, still render the section
            // and state WHY it passed — scanned clean — rather than showing nothing.
            if (s.failing.length > 0) {
              return s.failing.map((f, i) => (
                <FindingRow
                  key={`${s.key}-${f?.id ?? 'x'}-${i}`}
                  source={s.label}
                  finding={f}
                />
              ))
            }
            if (!hardenizeActive) return null
            const hzLabel = maturityLabel(payload.hardenize_suggested_score)
            return (
              <Typography
                key="feed-hardenize-clean"
                sx={{ fontSize: 12, color: '#555', mb: 0.75 }}
              >
                <Box component="span" sx={{ fontWeight: 600, color: '#333' }}>
                  {s.label}:
                </Box>{' '}
                no failing findings — scanned clean
                {hzLabel ? `, scored ${hzLabel}` : ''}
              </Typography>
            )
          })}
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

// A single ARS control ID pill. Three states: satisfied (green ✓), unsatisfied
// (grey ○ — informational, applicable-but-not-satisfied, no alarm), failing
// (red ✗ — a source found the control failing).
type ControlChipVariant = 'satisfied' | 'unsatisfied' | 'failing' | 'conflict'
const CONTROL_CHIP_STYLE: Record<
  ControlChipVariant,
  { marker: string; bgcolor: string; color: string; border: string }
> = {
  satisfied: {
    marker: '✓',
    bgcolor: '#e6f4ea',
    color: '#1e7e34',
    border: '1px solid #b7dfc2',
  },
  unsatisfied: {
    marker: '○',
    bgcolor: '#eceef2',
    color: '#5c636a',
    border: '1px solid #d8dce8',
  },
  failing: {
    marker: '✗',
    bgcolor: '#fdecec',
    color: '#b02a37',
    border: '1px solid #f1b0b0',
  },
  // Sources disagree (a pass AND a fail for the same control). Amber ⚠ so it reads
  // as "needs a human" rather than a settled pass/fail; the hover names both sides
  // and states how the score resolved it (weakest-link → failing).
  conflict: {
    marker: '⚠',
    bgcolor: '#fff4e5',
    color: '#a1560a',
    border: '1px solid #f0c680',
  },
}

// Plain-language reason behind each ARS chip's state, surfaced on hover and as the
// chip's accessible name. The rollup assigns a control exactly one of satisfied /
// not-satisfied / failing (weakest-link across sources), so the variant fully
// determines why it's coloured the way it is — no per-control text needed. Ordered
// passed / not-assessed / failed to match ✓ / ○ / ✗.
const CONTROL_CHIP_HELP: Record<ControlChipVariant, string> = {
  satisfied:
    'Satisfied — an evidence source passed this control and none failed it.',
  unsatisfied:
    'Not satisfied — applies to this question (per CFACTS) but no source has confirmed it satisfied.',
  failing: 'Failing — an evidence source found this control failing.',
  conflict:
    'Sources disagree — at least one passed this control and at least one failed it. Counted as failing (weakest-link); review the failing check.',
}

function ControlChip({
  id,
  variant,
  tooltip,
  ariaLabel,
}: {
  id: string
  variant: ControlChipVariant
  // When set, the chip label carries a hover with the fuller context — used by
  // the feed pass/fail chips, whose label is the check name and whose hover holds
  // the description, mapped control, and met/failed state. May be a rich
  // (multi-line) node.
  tooltip?: React.ReactNode
  // Plain-text equivalent of a rich tooltip, for the accessible name.
  ariaLabel?: string
}) {
  const style = CONTROL_CHIP_STYLE[variant]
  // Callers may pass their own tooltip/ariaLabel (the feed pass/fail chips do,
  // with a rich CheckTooltip); ARS chips pass neither, so fall back to the
  // variant's plain-language reason. Either way the chip always carries a hover
  // and an accessible name.
  const effectiveTooltip = tooltip ?? CONTROL_CHIP_HELP[variant]
  const effectiveAriaLabel = ariaLabel ?? `${id}: ${CONTROL_CHIP_HELP[variant]}`
  const chip = (
    <Box
      component="span"
      // role="img" + aria-label carries the pass/fail context to screen readers:
      // the ✓/○/✗ marker and colour are otherwise the only place the state lives
      // and neither is exposed to AT. A role is required — aria-label on a
      // role-less generic span is not reliably announced (NVDA/VoiceOver).
      role="img"
      aria-label={effectiveAriaLabel}
      // tabIndex makes the chip keyboard-focusable so the MUI Tooltip (which
      // listens for focus, not just hover) reaches keyboard-only sighted users —
      // the hover text would otherwise be mouse-only (508 / WCAG 1.4.13, 2.1.1).
      tabIndex={0}
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
        bgcolor: style.bgcolor,
        color: style.color,
        border: style.border,
        cursor: 'help',
        // Visible focus indicator (WCAG 2.4.7). Reuses the chip's own text colour,
        // which already meets contrast against its background.
        '&:focus-visible': {
          outline: `2px solid ${style.color}`,
          outlineOffset: '1px',
        },
      }}
    >
      <Box component="span">{style.marker}</Box>
      {id}
    </Box>
  )
  return (
    <Tooltip
      title={effectiveTooltip}
      placement="top"
      arrow
      slotProps={{ tooltip: { sx: { maxWidth: 340 } } }}
    >
      {chip}
    </Tooltip>
  )
}

// Rich hover for a feed pass/fail chip: the check slug (mono), its dictionary
// description, and a footer line with the NIST control, maturity level, and
// pass/fail status. Wider/multi-line so the description is readable rather than
// crammed onto the chip's single-line label.
function CheckTooltip({
  finding,
  pass,
}: {
  finding: InsightFinding
  pass: boolean
}) {
  const slug = asText(finding?.id) ?? asText(finding?.title)
  // The chip label now carries the check name (its code/slug), so the hover leads
  // with the human sentence, then the control it maps to, its severity, and the
  // met/failed state — what a reviewer needs to judge the finding. Kion puts that
  // sentence in `description`, SecurityHub in `title`; lead with whichever is
  // present so both feeds read the same. The slug is only a last-resort title so
  // the hover never names nothing.
  const name = asText(finding?.description) ?? asText(finding?.title)
  const nist = asText(finding?.nist_controls)
  const severity = asText(finding?.severity)
  const level = typeof finding?.level === 'number' ? finding.level : null
  const meta = [
    nist ? `Control: ${nist}` : undefined,
    level != null ? `Level ${level}` : undefined,
    severity ? severity.toUpperCase() : undefined,
    pass ? 'Passed' : 'Failed',
  ]
    .filter(Boolean)
    .join(' · ')
  // Affected hosts (Hardenize-only). When Hardenize renders as chips, its findings'
  // domains must live in the hover — chips have no room for the FindingRow's "N
  // domains" affordance, so without this the affected hosts would be lost. Kion and
  // SecurityHub carry no instances, so this is empty for them.
  const domains = (Array.isArray(finding?.instances) ? finding.instances : [])
    .map((inst) => ({
      domain: asText(inst?.domain),
      detail: formatHardenizeDetail(inst?.detail),
    }))
    .filter((d) => d.domain)
  return (
    <Box sx={{ py: 0.25 }}>
      {name ? (
        <Box sx={{ fontSize: 11, lineHeight: 1.5 }}>{name}</Box>
      ) : (
        slug && (
          <Box sx={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700 }}>
            {slug}
          </Box>
        )
      )}
      {meta && <Box sx={{ fontSize: 10, mt: 0.5, opacity: 0.8 }}>{meta}</Box>}
      {domains.length > 0 && (
        <Box sx={{ mt: 0.5 }}>
          <Box sx={{ fontSize: 10, fontWeight: 600, opacity: 0.9 }}>
            Affected {domains.length === 1 ? 'domain' : 'domains'}:
          </Box>
          {domains.map((d, i) => (
            <Box
              key={`${d.domain}-${i}`}
              sx={{ fontSize: 10, lineHeight: 1.5, opacity: 0.85 }}
            >
              {d.domain}
              {d.detail ? ` — ${d.detail}` : ''}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}

// ARS-style pass/fail block for one finding-source — the SINGLE rendering path
// for every finding-source, so all questions look uniform (no fallback to the
// old verbose FindingRow list). One ✓/✗ chip per check: passing from
// `{source}_passing` (green — no finding), failing from `findings.{source}`
// (red — has a finding), labeled by the check name (finding slug) with the
// description + mapped control + met/failed state in the hover. Reviewers asked
// to see the finding itself, not the control it rolls up to, so the name is on
// the chip and the control moved into the tooltip. Rollup is per-check — the
// same control can repeat because each check is distinct.
//
// Header adapts to what shipped: when the passing array is present we can state
// the full "N of M checks passed"; when it's absent (source has only failing
// findings, passing not yet emitted) we DON'T fabricate a pass count — we label
// the failing checks honestly instead. Both render the same chip row, so the
// look is uniform regardless. Normalizes to the full count everywhere once the
// backend emits `{source}_passing` on every question.
function FeedCheckBlock({
  label,
  passing,
  failing,
  hasPassing,
}: {
  label: string
  passing: InsightFinding[]
  failing: InsightFinding[]
  hasPassing: boolean
}) {
  const chips = [
    ...passing.map((f) => ({ pass: true, f })),
    ...failing.map((f) => ({ pass: false, f })),
  ]
  const passed = passing.length
  const total = chips.length
  const summary = hasPassing
    ? `${passed} of ${total} check${total === 1 ? '' : 's'} passed`
    : `${failing.length} finding${failing.length === 1 ? '' : 's'}`
  return (
    <Box sx={{ mb: 0.75 }}>
      <Typography sx={{ fontSize: 12, color: '#555' }}>
        <Box component="span" sx={{ fontWeight: 600, color: '#333' }}>
          {label}:
        </Box>{' '}
        {summary}
      </Typography>
      {total > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
          {chips.map(({ pass, f }, i) => {
            const nist = asText(f?.nist_controls)
            const slug = asText(f?.id) ?? asText(f?.title)
            const desc = asText(f?.description) ?? asText(f?.title)
            // Fold pass/fail into the accessible name — the ✓/✗ + color is the
            // only other place that distinction lives, and neither is exposed to
            // a screen reader (508).
            const ariaLabel = [slug, desc, pass ? 'Passed' : 'Failed']
              .filter(Boolean)
              .join(' — ')
            return (
              <ControlChip
                key={`${pass ? 'p' : 'f'}-${slug ?? ''}-${i}`}
                id={slug ?? nist ?? '—'}
                variant={pass ? 'satisfied' : 'failing'}
                tooltip={<CheckTooltip finding={f} pass={pass} />}
                ariaLabel={ariaLabel || undefined}
              />
            )
          })}
        </Box>
      )}
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
export function severityStyle(sev?: string): { bg: string; fg: string } {
  const s = (sev ?? '').toLowerCase()
  if (s === 'error' || s === 'high' || s === 'critical')
    return { bg: '#fdecec', fg: '#b02a37' }
  if (s === 'warning' || s === 'warn' || s === 'medium')
    return { bg: '#fff4e5', fg: '#b26a00' }
  return { bg: '#f0f0f0', fg: '#666' }
}

// TEMPORARY stopgap severity glossary shown on hover when a finding has no
// dictionary description yet. The long-term home for this copy is the findings
// dictionary / Snowflake view (ztmf-insights#32) — remove this map once the
// dictionary covers findings and the scoring-treatment classification lands.
const SEVERITY_HELP: Record<string, string> = {
  error:
    'A failing check — the scanner found a condition that does not meet the control. Review the finding and affected hosts; some (e.g. connection failures) may reflect reachability rather than a security weakness.',
  critical: 'A critical failing check — remediate urgently.',
  high: 'A high-severity failing check — prioritize remediation.',
  warning: 'A moderate issue worth addressing, lower priority than an error.',
  medium: 'A moderate issue worth addressing, lower priority than high/error.',
  low: 'A low-severity or informational finding.',
  notice:
    'An informational notice — a best-practice observation, not a failing check.',
  powerup:
    'A recommended enhancement, not a failure — an opportunity to further harden this host beyond the baseline.',
  inconclusive:
    'Inconclusive — the scanner could not reach the host to test it, often because the domain is private/internal or retired. This is not a pass or a fail and does not count against the score.',
  unknown:
    'Inconclusive — the scanner could not reach the host to test it, often because the domain is private/internal or retired. This is not a pass or a fail and does not count against the score.',
}
function severityHelp(sev?: string): string | undefined {
  return SEVERITY_HELP[(sev ?? '').toLowerCase()]
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
    check?: string
  ) => {
    const text = asText(raw)
    if (!text) return
    // One check can map to several controls, e.g. "AC-2, AC-3".
    for (const part of text.split(',')) {
      const id = part.trim()
      if (!id) continue
      const list = map.get(id) ?? []
      list.push({ source, state, check })
      map.set(id, list)
    }
  }
  const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
  const finding = (f: unknown) =>
    f && typeof f === 'object'
      ? (f as { nist_controls?: unknown; id?: unknown; title?: unknown })
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
    arr((payload as Record<string, unknown>)[`${src}_passing`]).forEach((f) => {
      const o = finding(f)
      add(
        o?.nist_controls,
        label,
        'satisfied',
        asText(o?.id) ?? asText(o?.title)
      )
    })
    arr(findings[src]).forEach((f) => {
      const o = finding(f)
      add(o?.nist_controls, label, 'failing', asText(o?.id) ?? asText(o?.title))
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

// Plain-text words for a control's net state and each evidence line — shared by the
// hover and the accessible name so sighted and AT users read the same thing.
const CONTROL_STATE_WORD: Record<ControlRollupState, string> = {
  satisfied: 'satisfied',
  failing: 'failing',
  unsatisfied: 'not satisfied',
}
const CONTROL_EVIDENCE_WORD: Record<ControlRollupState, string> = {
  satisfied: 'passed',
  failing: 'failed',
  unsatisfied: 'not assessed',
}
function controlEvidenceLine(e: ControlEvidence): string {
  return `${e.source}${e.check ? ` · ${e.check}` : ''} · ${CONTROL_EVIDENCE_WORD[e.state]}`
}
// Accessible name folds the net state, the conflict note, and every source line
// into one string — the ✓/○/✗/⚠ marker and colour are otherwise the only place the
// state and its provenance live, and neither reaches a screen reader (508).
function controlAriaLabel(c: ControlRollup): string {
  const head = c.conflict
    ? `${c.id}: sources disagree, counted as ${CONTROL_STATE_WORD[c.state]}`
    : `${c.id}: ${CONTROL_STATE_WORD[c.state]}`
  return `${head}. ${c.evidence.map(controlEvidenceLine).join('; ')}.`
}

// Rich hover for an ARS control chip: the control id, a conflict note stating how a
// disagreement resolved, then one line per source/check so the user can see exactly
// why the control is met or failed and address a conflict at its source.
function ControlTooltip({ control }: { control: ControlRollup }) {
  return (
    <Box sx={{ py: 0.25 }}>
      <Box sx={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700 }}>
        {control.id}
      </Box>
      {control.conflict && (
        <Box sx={{ fontSize: 10, mt: 0.5, color: '#ffd9a0', lineHeight: 1.5 }}>
          ⚠ Sources disagree — counted as {CONTROL_STATE_WORD[control.state]}{' '}
          (weakest-link). Review the failing check to resolve.
        </Box>
      )}
      <Box sx={{ mt: 0.5 }}>
        {control.evidence.map((e, i) => (
          <Box
            key={`${e.source}-${e.check ?? ''}-${i}`}
            sx={{ fontSize: 10, lineHeight: 1.5, opacity: 0.9 }}
          >
            {controlEvidenceLine(e)}
          </Box>
        ))}
      </Box>
    </Box>
  )
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
  // The payload is opaque — a findings array could contain a null/non-object
  // element. Guard so it degrades to nothing instead of throwing on field
  // access (which the boundary would turn into a blanked panel).
  if (!finding || typeof finding !== 'object') return null
  const code = asText(finding.id)
  const heading = asText(finding.title)
  const severity = asText(finding.severity)
  const sevStyle = severityStyle(severity)
  const description = asText(finding.description)
  // The severity badge's hover carries the "what it means" text: prefer the
  // finding's dictionary-seeded description; fall back to the temporary generic
  // per-severity glossary until the dictionary covers everything (see
  // ztmf-insights#32). This lets an alarming badge (e.g. a red "error" that is
  // really a reachability finding) be honestly contextualized on hover.
  const sevTooltip = description ?? severityHelp(severity)
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
    <Typography
      component="div"
      sx={{ fontSize: 12, color: '#555', mb: 0.75, lineHeight: 1.6 }}
    >
      <Box component="span" sx={{ fontWeight: 600, color: '#333' }}>
        {source}:
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
        <Tooltip
          title={sevTooltip ?? ''}
          placement="top"
          arrow
          disableHoverListener={!sevTooltip}
          disableFocusListener={!sevTooltip}
          disableTouchListener={!sevTooltip}
        >
          <Box
            component="span"
            aria-label={sevTooltip ? `${severity}: ${sevTooltip}` : undefined}
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
              cursor: sevTooltip ? 'help' : undefined,
              borderBottom: sevTooltip ? '1px dotted currentColor' : undefined,
            }}
          >
            {severity}
          </Box>
        </Tooltip>
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
      {/* Description lives in the severity badge hover. When a finding has no
          severity badge to carry it, show it in the body so it isn't lost. */}
      {!severity && description && (
        <Box sx={{ mt: 0.25, color: '#666' }}>{description}</Box>
      )}
      {CONFIG.INSIGHTS_SUGGEST_FIX_ENABLED && remediation && (
        <Box sx={{ mt: 0.25, color: '#5a6a8a' }}>
          <Box component="span" sx={{ fontWeight: 600 }}>
            How to fix:
          </Box>{' '}
          {remediation}
        </Box>
      )}
    </Typography>
  )
}
