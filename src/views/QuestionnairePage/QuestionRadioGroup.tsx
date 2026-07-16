import * as React from 'react'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import { QuestionChoice, InsightPayload } from '@/types'
import { OptionInsightBadges } from './InsightsPanel/InsightsPanel'
import {
  baselineCeiling,
  isAboveBaseline,
  asImpactLevel,
  FIPS_GOLD as GOLD,
  FIPS_BASELINE as BASELINE,
} from './fipsBaseline'

// Maturity answer options as a native-radio fieldset (not CMSDS ChoiceList) so
// we can layer the FIPS baseline treatment — a per-option box, an in-list
// divider, and per-option badges — which a flat ChoiceList can't express. Native
// <input type="radio"> keeps keyboard operation and the focus ring for free
// (508); styling is MUI-only so the CMSDS CSS/JS version drift never touches it.
//
// The FIPS *strip* lives in the insights panel (above the chips); this component
// owns only the per-option markers: a dotted box on the baseline-level option
// ("where you should be") and solid gold boxes on the above-baseline options.

const SR_ONLY = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const

type Props = {
  options: QuestionChoice[]
  name: string
  // Currently selected option value (functionoptionid), from the page's
  // selectQuestionOption state; -1 when nothing is chosen yet.
  selectedValue: number
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  disabled?: boolean
  insight?: InsightPayload
  viewedDatacall?: string
}

export default function QuestionRadioGroup({
  options,
  name,
  selectedValue,
  onChange,
  disabled,
  insight,
  viewedDatacall,
}: Props) {
  const ceiling = baselineCeiling(insight?.fips_ceiling)
  const level = asImpactLevel(insight?.fips_impact_level)
  // Same gate as the panel strip (showFipsStrip): a real impact level plus
  // headroom above the baseline. A High/ceiling-4 or null-FIPS system has no
  // baseline treatment, so strip and per-option markers appear/vanish together.
  const hasBaseline = level != null && ceiling < 4

  // Effective selection: the page state once the user has chosen, otherwise the
  // option flagged defaultChecked (the saved answer) so a pre-loaded above-
  // baseline answer reflects its state on first paint.
  const effectiveSelected =
    selectedValue >= 0
      ? selectedValue
      : options.find((o) => o.defaultChecked)?.value ?? -1
  const selectedScore = options.find(
    (o) => o.value === effectiveSelected
  )?.score
  const selectedAbove =
    hasBaseline &&
    selectedScore != null &&
    isAboveBaseline(selectedScore, ceiling)

  const firstAboveIdx = options.findIndex(
    (o) => o.score != null && isAboveBaseline(o.score, ceiling)
  )

  const dashedLine = (
    <Box
      sx={{
        flex: 1,
        height: '1px',
        background: `repeating-linear-gradient(to right, ${GOLD.dividerLine} 0 6px, transparent 6px 12px)`,
      }}
    />
  )

  return (
    <Box>
      <Box
        component="fieldset"
        sx={{ border: 0, p: 0, m: 0, minInlineSize: 'auto' }}
      >
        <Box component="legend" sx={SR_ONLY}>
          Select a maturity level
        </Box>
        {options.map((o, i) => {
          const above =
            hasBaseline && o.score != null && isAboveBaseline(o.score, ceiling)
          // The option at the ceiling is the baseline level — "where you should
          // be" — a dotted box, distinct from the solid gold above-baseline ones.
          const atBaseline = hasBaseline && o.score === ceiling
          const boxed = above || atBaseline
          const id = `${name}-${o.value}`
          return (
            <React.Fragment key={o.value}>
              {above && selectedAbove && i === firstAboveIdx && (
                <Box
                  aria-hidden="true"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    my: 0.75,
                    mx: '-10px',
                  }}
                >
                  {dashedLine}
                  <Box
                    sx={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: GOLD.dividerLabel,
                      whiteSpace: 'nowrap',
                      bgcolor: GOLD.box,
                      px: 1,
                      py: '1px',
                      border: `1px solid ${GOLD.border}`,
                      borderRadius: '3px',
                      letterSpacing: '0.3px',
                    }}
                  >
                    &#9650; above {level} baseline
                  </Box>
                  {dashedLine}
                </Box>
              )}
              <Box
                component="label"
                htmlFor={id}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.25,
                  cursor: disabled ? 'default' : 'pointer',
                  minHeight: 44,
                  p: boxed ? '8px 10px' : '8px 0',
                  mx: boxed ? '-10px' : 0,
                  my: boxed ? '2px' : 0,
                  borderRadius: boxed ? '6px' : 0,
                  border: above
                    ? `1.5px solid ${GOLD.border}`
                    : atBaseline
                      ? `1.5px dashed ${BASELINE.border}`
                      : '1.5px solid transparent',
                  bgcolor: above
                    ? GOLD.box
                    : atBaseline
                      ? BASELINE.box
                      : 'transparent',
                }}
              >
                <Box
                  component="input"
                  type="radio"
                  id={id}
                  name={name}
                  value={o.value}
                  checked={o.value === effectiveSelected}
                  onChange={onChange}
                  disabled={disabled}
                  sx={{
                    mt: '2px',
                    width: 20,
                    height: 20,
                    flexShrink: 0,
                    accentColor: above ? GOLD.dividerLabel : '#1b1b4f',
                    cursor: disabled ? 'default' : 'pointer',
                  }}
                />
                {/* Normal inline flow (not flex) so a trailing chip sits at the
                    end of the last wrapped line, not dropped onto its own row. */}
                <Box
                  component="span"
                  sx={{ fontSize: 14, lineHeight: 1.5, flex: 1 }}
                >
                  {o.label}
                  {/* Non-color cue for AT: expose the baseline relationship to
                      assistive tech regardless of the visible (color) treatment.
                      Suppressed when the option is selected — the visible chip
                      below is focusable and carries the same aria-label, so this
                      would double-announce on the selected above-baseline row. */}
                  {above && !selectedAbove && (
                    <Box component="span" sx={SR_ONLY}>
                      {` (above the ${level} baseline)`}
                    </Box>
                  )}
                  {atBaseline && (
                    <Tooltip
                      title={`Your baseline — the maturity level a ${level}-impact system is expected to reach`}
                      placement="top"
                      arrow
                    >
                      <Box
                        component="span"
                        tabIndex={0}
                        aria-label={`${level} baseline — your system's expected maturity level`}
                        sx={{
                          display: 'inline-block',
                          verticalAlign: 'middle',
                          ml: 0.75,
                          fontSize: 10,
                          fontWeight: 700,
                          bgcolor: BASELINE.badgeBg,
                          color: BASELINE.badgeText,
                          px: 0.75,
                          py: 0.125,
                          borderRadius: '4px',
                          letterSpacing: '0.3px',
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap',
                          cursor: 'help',
                        }}
                      >
                        {level} baseline
                      </Box>
                    </Tooltip>
                  )}
                  {above && selectedAbove && (
                    <Tooltip
                      title={`Above your ${level} baseline — optional, not required to reach; worth documenting what's driving it`}
                      placement="top"
                      arrow
                    >
                      <Box
                        component="span"
                        tabIndex={0}
                        aria-label={`above the ${level} baseline — optional`}
                        sx={{
                          display: 'inline-block',
                          verticalAlign: 'middle',
                          ml: 0.75,
                          fontSize: 10,
                          fontWeight: 700,
                          bgcolor: GOLD.badgeBg,
                          color: GOLD.badgeText,
                          px: 0.75,
                          py: 0.125,
                          borderRadius: '4px',
                          letterSpacing: '0.3px',
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap',
                          cursor: 'help',
                        }}
                      >
                        above {level} baseline
                      </Box>
                    </Tooltip>
                  )}
                  <OptionInsightBadges
                    score={o.score}
                    insight={insight}
                    viewedDatacall={viewedDatacall}
                  />
                </Box>
              </Box>
            </React.Fragment>
          )
        })}
      </Box>

      {/* Live region is always mounted (only its content toggles) so screen
          readers reliably announce the notice when an above-baseline option is
          selected — a region added at the same tick as its text is sometimes
          skipped. */}
      <Box role="status" aria-live="polite">
        {selectedAbove && (
          <Box
            sx={{
              bgcolor: GOLD.box,
              border: `1px solid ${GOLD.border}`,
              borderRadius: '6px',
              p: '10px 14px',
              mt: 2,
              fontSize: 12,
              color: GOLD.text,
              lineHeight: 1.5,
            }}
          >
            <Box
              component="span"
              sx={{
                fontWeight: 700,
                color: GOLD.strong,
                display: 'block',
                mb: 0.5,
              }}
            >
              Above-baseline selection
            </Box>
            This system is operating above the {level} baseline. Consider adding
            a note below describing what&rsquo;s driving this maturity level.
          </Box>
        )}
      </Box>
    </Box>
  )
}
