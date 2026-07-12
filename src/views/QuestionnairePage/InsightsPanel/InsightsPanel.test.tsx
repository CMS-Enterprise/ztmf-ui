import { render, screen, fireEvent } from '@testing-library/react'
import InsightsPanel, { OptionInsightBadges } from './InsightsPanel'
import type { InsightPayload } from '@/types'

const fullPayload: InsightPayload = {
  suggested_score: 1,
  suggested_label: 'Traditional',
  evidence_sources: 'Kion, SecurityHub, Hardenize',
  score_floor_source: 'Kion (failing password policy)',
  score_direction: 'lower',
  last_score: 2,
  last_score_label: 'Initial',
  has_kion_data: true,
  kion_suggested_score: 1,
  has_sechub_data: true,
  sechub_suggested_score: 1,
  has_hardenize_data: false,
  cfacts_suggested_score: 2,
  cfacts_reasoning: 'IDM-Okta detected. MFA required, PR-MFA not available.',
  ars_maturity: 'Initial',
  ars_control_score: 2,
  ars_controls_total: 4,
  ars_controls_satisfied: 4,
  findings: {
    kion: [
      {
        id: 'iam-user-without-mfa-device-enabled',
        nist_controls: 'IA-02',
        remediation: 'Enable an MFA device for the user.',
      },
    ],
    sechub: [
      { id: 'IAM.10', title: 'MFA should be enabled', severity: 'MEDIUM' },
    ],
  },
}

describe('InsightsPanel', () => {
  it('renders the ZTMF Insights label and all five source chips', () => {
    render(<InsightsPanel payload={fullPayload} />)
    expect(screen.getByText('ZTMF Insights')).toBeInTheDocument()
    for (const source of [
      'Kion',
      'SecurityHub',
      'Hardenize',
      'CFACTS',
      'ARS',
    ]) {
      expect(screen.getByText(source)).toBeInTheDocument()
    }
  })

  it('renders the suggested maturity pill when the suggestion differs from the prior score', () => {
    render(<InsightsPanel payload={fullPayload} />)
    expect(screen.getByText(/Suggested: Traditional \(1\)/)).toBeInTheDocument()
  })

  it('labels the pill "Confirmed" when the suggestion matches the prior score', () => {
    render(<InsightsPanel payload={{ ...fullPayload, last_score: 1 }} />)
    expect(screen.getByText(/Confirmed: Traditional \(1\)/)).toBeInTheDocument()
  })

  it('marks a source with no data using a dash instead of a score', () => {
    render(<InsightsPanel payload={fullPayload} />)
    // Hardenize has has_hardenize_data:false, so its dot renders an en-dash.
    expect(screen.getByText('–')).toBeInTheDocument()
  })

  it('shows "No suggestion" when suggested_score is null', () => {
    render(<InsightsPanel payload={{ suggested_score: null }} />)
    expect(screen.getByText('No suggestion')).toBeInTheDocument()
  })

  it('hides findings until details is toggled, then reveals them', () => {
    render(<InsightsPanel payload={fullPayload} />)
    expect(
      screen.queryByText(/iam-user-without-mfa-device-enabled/)
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /details/i }))

    expect(
      screen.getByText(/iam-user-without-mfa-device-enabled/)
    ).toBeInTheDocument()
    expect(screen.getByText(/IAM\.10/)).toBeInTheDocument()
  })

  it('lists ARS control IDs in the details when the pipeline provides them', () => {
    render(
      <InsightsPanel
        payload={{ ...fullPayload, ars_controls: ['IA-01', 'IA-02(01)'] }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /details/i }))
    expect(screen.getByText(/IA-01, IA-02\(01\)/)).toBeInTheDocument()
  })

  it('shows the ARS Controls count with no list when ars_controls is absent', () => {
    render(<InsightsPanel payload={fullPayload} />)
    fireEvent.click(screen.getByRole('button', { name: /details/i }))
    expect(screen.getByText(/4 of 4 satisfied/)).toBeInTheDocument()
    expect(screen.queryByText(/IA-01/)).not.toBeInTheDocument()
  })

  it('renders a minimal payload without a details toggle', () => {
    render(
      <InsightsPanel
        payload={{ suggested_score: 3, suggested_label: 'Advanced' }}
      />
    )
    expect(screen.getByText(/Suggested: Advanced \(3\)/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /details/i })
    ).not.toBeInTheDocument()
  })
})

describe('OptionInsightBadges', () => {
  const insight: InsightPayload = {
    suggested_score: 1,
    last_score: 2,
    last_datacall: 'FY2024 Q1',
  }

  it('renders the recommendation badge on the suggested option', () => {
    render(<OptionInsightBadges score={1} insight={insight} />)
    expect(screen.getByText('ZTMF Insights')).toBeInTheDocument()
    expect(screen.queryByText(/FY2024 Q1 answer/)).not.toBeInTheDocument()
  })

  it("renders the prior-answer badge on last year's option", () => {
    render(<OptionInsightBadges score={2} insight={insight} />)
    expect(screen.getByText('FY2024 Q1 answer')).toBeInTheDocument()
    expect(screen.queryByText('ZTMF Insights')).not.toBeInTheDocument()
  })

  it('renders both badges when the suggestion and prior score coincide', () => {
    render(
      <OptionInsightBadges
        score={3}
        insight={{ suggested_score: 3, last_score: 3, last_datacall: 'FY2024' }}
      />
    )
    expect(screen.getByText('ZTMF Insights')).toBeInTheDocument()
    expect(screen.getByText('FY2024 answer')).toBeInTheDocument()
  })

  it('falls back to a generic prior label when last_datacall is absent', () => {
    render(<OptionInsightBadges score={2} insight={{ last_score: 2 }} />)
    expect(screen.getByText("Last year's answer")).toBeInTheDocument()
  })

  it('renders nothing for an option matching neither score', () => {
    const { container } = render(
      <OptionInsightBadges score={4} insight={insight} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when there is no insight', () => {
    const { container } = render(<OptionInsightBadges score={1} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('suppresses the prior-answer badge when viewing the call it names (slug form)', () => {
    render(
      <OptionInsightBadges
        score={2}
        insight={insight}
        viewedDatacall="FY2024_Q1"
      />
    )
    expect(screen.queryByText('FY2024 Q1 answer')).not.toBeInTheDocument()
  })

  it('still shows the prior-answer badge when viewing a different call', () => {
    render(
      <OptionInsightBadges
        score={2}
        insight={insight}
        viewedDatacall="FY25_ZTM"
      />
    )
    expect(screen.getByText('FY2024 Q1 answer')).toBeInTheDocument()
  })

  it('keeps the recommendation badge even when the prior badge is suppressed', () => {
    // suggested (1) and prior (1) coincide on the same option; viewing the prior
    // call should drop only the prior badge, not the recommendation.
    render(
      <OptionInsightBadges
        score={1}
        insight={{
          suggested_score: 1,
          last_score: 1,
          last_datacall: 'FY2024 Q1',
        }}
        viewedDatacall="FY2024_Q1"
      />
    )
    expect(screen.getByText('ZTMF Insights')).toBeInTheDocument()
    expect(screen.queryByText('FY2024 Q1 answer')).not.toBeInTheDocument()
  })
})

describe('InsightsPanel resilience (opaque payload)', () => {
  it('degrades gracefully when a findings field is not an array', () => {
    render(
      <InsightsPanel
        payload={{
          suggested_score: 2,
          evidence_sources: 'ARS, CFACTS',
          findings: { kion: 'not-an-array' as unknown as [] },
        }}
      />
    )
    expect(screen.getByText('ZTMF Insights')).toBeInTheDocument()
    // The malformed findings block is skipped, not thrown on.
    fireEvent.click(screen.getByRole('button', { name: /details/i }))
    expect(screen.getByText(/ARS, CFACTS/)).toBeInTheDocument()
  })

  it('renders nothing (no page crash) when a rendered field throws', () => {
    // evidence_sources arriving as an object would throw "Objects are not valid
    // as a React child" when details opens; the error boundary must swallow it
    // so the surrounding questionnaire is never taken down.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <InsightsPanel
        payload={{
          suggested_score: 2,
          evidence_sources: { bad: true } as unknown as string,
        }}
      />
    )
    expect(screen.getByText('ZTMF Insights')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /details/i }))
    // Boundary caught the throw and rendered nothing in place of the panel.
    expect(screen.queryByText('ZTMF Insights')).not.toBeInTheDocument()
    spy.mockRestore()
  })
})
