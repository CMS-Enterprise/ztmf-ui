import { render, screen, fireEvent } from '@testing-library/react'
import QuestionRadioGroup from './QuestionRadioGroup'
import type { QuestionChoice, InsightPayload } from '@/types'

// QuestionRadioGroup pulls in OptionInsightBadges → InsightsPanel → @/utils/config,
// which reads import.meta.env; stub it so Jest can parse the module graph.
jest.mock('@/utils/config', () => ({
  __esModule: true,
  default: { INSIGHTS_SUGGEST_FIX_ENABLED: false },
}))

const OPTIONS: QuestionChoice[] = [
  { label: 'Traditional answer', value: 11, score: 1 },
  { label: 'Initial answer', value: 12, score: 2 },
  { label: 'Advanced answer', value: 13, score: 3 },
  { label: 'Optimal answer', value: 14, score: 4 },
]

// Low FIPS → ceiling 2 (Initial): options scoring 3 and 4 are above baseline.
const LOW_FIPS: InsightPayload = { fips_impact_level: 'Low', fips_ceiling: 2 }

const noop = () => {}

function renderGroup(
  props: Partial<React.ComponentProps<typeof QuestionRadioGroup>> = {}
) {
  return render(
    <QuestionRadioGroup
      options={OPTIONS}
      name="q"
      selectedValue={-1}
      onChange={noop}
      {...props}
    />
  )
}

describe('QuestionRadioGroup', () => {
  it('renders each option as a keyboard radio with the option text as its name', () => {
    renderGroup()
    expect(screen.getAllByRole('radio')).toHaveLength(4)
    expect(
      screen.getByRole('radio', { name: /Advanced answer/i })
    ).toBeInTheDocument()
  })

  it('passes the chosen option value through onChange (drop-in for the old ChoiceList)', () => {
    const onChange = jest.fn()
    renderGroup({ onChange })
    fireEvent.click(screen.getByRole('radio', { name: /Advanced answer/i }))
    expect(onChange).toHaveBeenCalledTimes(1)
    // The page's handleChoiceChange does Number(event.target.value); the input
    // must carry the option's functionoptionid (13) as its value.
    expect(onChange.mock.calls[0][0].target.value).toBe('13')
  })

  it('renders disabled radios when disabled (read-only)', () => {
    renderGroup({ disabled: true })
    screen
      .getAllByRole('radio')
      .forEach((radio) => expect(radio).toBeDisabled())
  })

  describe('with no FIPS data', () => {
    it('renders plain radios — no baseline treatment at all', () => {
      renderGroup()
      expect(screen.queryByText(/baseline/i)).not.toBeInTheDocument()
    })
  })

  describe('with a FIPS baseline (Low → ceiling 2)', () => {
    it('marks the ceiling option as the baseline and flags options above it', () => {
      renderGroup({ insight: LOW_FIPS })
      // The Initial option (score 2 == ceiling) gets the "Low baseline" chip.
      expect(screen.getByText('Low baseline')).toBeInTheDocument()
      // Advanced + Optimal (scores 3, 4) each carry the sr-only above-baseline cue.
      expect(screen.getAllByText(/above the Low baseline/i)).toHaveLength(2)
    })

    it('escalates when an above-baseline option is selected: divider, badge, and notice', () => {
      renderGroup({ insight: LOW_FIPS, selectedValue: 13 }) // Advanced (score 3)
      expect(screen.getByText('Above-baseline selection')).toBeInTheDocument()
      // The visible "above Low baseline" appears (divider label + per-option badges).
      expect(screen.getAllByText(/above Low baseline/i).length).toBeGreaterThan(
        0
      )
    })

    it('shows no escalation notice when an at/below-baseline option is selected', () => {
      renderGroup({ insight: LOW_FIPS, selectedValue: 12 }) // Initial (at ceiling)
      expect(
        screen.queryByText('Above-baseline selection')
      ).not.toBeInTheDocument()
    })

    it('reflects a pre-loaded (defaultChecked) above-baseline answer as escalated', () => {
      const preloaded = OPTIONS.map((o) =>
        o.value === 14 ? { ...o, defaultChecked: true } : o
      )
      render(
        <QuestionRadioGroup
          options={preloaded}
          name="q"
          selectedValue={-1}
          onChange={noop}
          insight={LOW_FIPS}
        />
      )
      expect(screen.getByText('Above-baseline selection')).toBeInTheDocument()
    })
  })

  describe('fallbacks (feature stays invisible)', () => {
    it('High / ceiling 4 (no headroom) shows no baseline treatment', () => {
      renderGroup({
        insight: { fips_impact_level: 'High', fips_ceiling: 4 },
      })
      expect(screen.queryByText(/baseline/i)).not.toBeInTheDocument()
    })

    it('null FIPS (no impact level) shows no baseline treatment', () => {
      renderGroup({
        insight: { fips_impact_level: null, fips_ceiling: null },
      })
      expect(screen.queryByText(/baseline/i)).not.toBeInTheDocument()
    })

    it('malformed level (a number on the opaque payload) is ignored — no throw, no treatment', () => {
      renderGroup({
        insight: {
          fips_impact_level: 3 as unknown as null,
          fips_ceiling: 2,
        },
      })
      expect(screen.queryByText(/baseline/i)).not.toBeInTheDocument()
    })
  })
})
