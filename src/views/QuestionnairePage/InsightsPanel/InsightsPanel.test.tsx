import { render, screen, fireEvent } from '@testing-library/react'
import InsightsPanel, {
  OptionInsightBadges,
  severityStyle,
} from './InsightsPanel'
import type { InsightPayload } from '@/types'
import CONFIG from '@/utils/config'

// The "How to fix" remediation is gated by CONFIG.INSIGHTS_SUGGEST_FIX_ENABLED,
// which is false in the test env (no VITE_INSIGHTS_SUGGEST_FIX_ENABLED). Mock the
// config so the default is ON here (matching impl); tests flip the flag on the
// imported (mocked) CONFIG object, which the component reads by the same
// reference. Only the flag field is used by this subtree, so a partial mock is
// safe. jest.mock is hoisted above imports, so the flag object is created inside
// the factory (referencing an outer const would hit the TDZ).
jest.mock('@/utils/config', () => ({
  __esModule: true,
  default: { INSIGHTS_SUGGEST_FIX_ENABLED: true },
}))

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
    // Chips render the source name with a trailing colon (e.g. "Kion:").
    for (const source of [
      'Kion',
      'SecurityHub',
      'Hardenize',
      'CFACTS',
      'ARS',
    ]) {
      expect(screen.getByText(`${source}:`)).toBeInTheDocument()
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
    // Hardenize has has_hardenize_data:false, so its badge renders an em-dash
    // instead of a maturity word.
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows "No suggestion" when suggested_score is null', () => {
    render(<InsightsPanel payload={{ suggested_score: null }} />)
    expect(screen.getByText('No suggestion')).toBeInTheDocument()
  })

  it('shows a hardenize finding heading + affected domains', () => {
    render(
      <InsightsPanel
        payload={{
          suggested_score: 1,
          findings: {
            hardenize: [
              {
                id: 'WWW_TLS_CONN_FAILED',
                title: 'TLS connection failed',
                description: 'Hardenize could not connect to the domain.',
                severity: 'error',
                instances: [
                  {
                    domain: 'portaldev.cms.gov',
                    detail: '{"Error":"timeout"}',
                  },
                  { domain: 'api.cms.gov', detail: '' },
                ],
              },
            ],
          },
        }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /details/i }))
    expect(screen.getByText('TLS connection failed')).toBeInTheDocument()
    // Description lives in the severity badge hover, not the card body.
    expect(
      screen.getByLabelText(
        /error: Hardenize could not connect to the domain\./
      )
    ).toBeInTheDocument()
    // Domains affordance + reachable via aria-label (hover reveals the list).
    expect(screen.getByText('2 domains')).toBeInTheDocument()
    expect(
      screen.getByLabelText('portaldev.cms.gov, api.cms.gov')
    ).toBeInTheDocument()
  })

  it('renders a hardenize finding with no domains and no crash', () => {
    render(
      <InsightsPanel
        payload={{
          suggested_score: 1,
          findings: {
            hardenize: [
              {
                id: 'WWW_HSTS_POWERUP',
                title: 'Deploy HSTS',
                severity: 'warn',
              },
            ],
          },
        }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /details/i }))
    expect(screen.getByText('Deploy HSTS')).toBeInTheDocument()
    expect(screen.queryByText(/domain/)).not.toBeInTheDocument()
  })

  it('renders a finding uniformly: code, title, description, severity, How to fix', () => {
    render(
      <InsightsPanel
        payload={{
          suggested_score: 1,
          findings: {
            sechub: [
              {
                id: 'IAM.10',
                title: 'MFA should be enabled',
                description: 'Enable MFA for all IAM users.',
                remediation: 'Turn on MFA in the IAM console.',
                severity: 'MEDIUM',
              },
            ],
          },
        }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /details/i }))
    expect(screen.getByText('IAM.10')).toBeInTheDocument()
    expect(screen.getByText('MFA should be enabled')).toBeInTheDocument()
    // Description surfaces in the severity badge hover, not the card body.
    expect(
      screen.getByLabelText(/MEDIUM: Enable MFA for all IAM users\./)
    ).toBeInTheDocument()
    expect(screen.getByText('MEDIUM')).toBeInTheDocument()
    expect(screen.getByText(/How to fix/)).toBeInTheDocument()
  })

  it('hides "How to fix" when INSIGHTS_SUGGEST_FIX_ENABLED is off, keeping the finding and CFACTS reasoning', () => {
    CONFIG.INSIGHTS_SUGGEST_FIX_ENABLED = false
    try {
      render(
        <InsightsPanel
          payload={{
            suggested_score: 1,
            cfacts_reasoning: 'IDM-Okta detected. MFA required.',
            findings: {
              sechub: [
                {
                  id: 'IAM.10',
                  title: 'MFA should be enabled',
                  remediation: 'Turn on MFA in the IAM console.',
                  severity: 'MEDIUM',
                },
              ],
            },
          }}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: /details/i }))
      // Remediation gated off...
      expect(screen.queryByText(/How to fix/)).not.toBeInTheDocument()
      expect(
        screen.queryByText(/Turn on MFA in the IAM console/)
      ).not.toBeInTheDocument()
      // ...but the finding itself and the CFACTS reasoning still render.
      expect(screen.getByText('IAM.10')).toBeInTheDocument()
      expect(screen.getByText('MFA should be enabled')).toBeInTheDocument()
      expect(screen.getByText(/IDM-Okta detected/)).toBeInTheDocument()
    } finally {
      CONFIG.INSIGHTS_SUGGEST_FIX_ENABLED = true
    }
  })

  it('hides findings until details is toggled, then reveals them', () => {
    render(<InsightsPanel payload={fullPayload} />)
    // Nothing in the drawer shows until expanded.
    expect(screen.queryByText(/IAM\.10/)).not.toBeInTheDocument()
    expect(screen.queryByText('IA-02')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /details/i }))

    // Kion renders as its pass/fail chip block (failing chip labeled by the
    // NIST tag, ✗); the sechub finding renders as a FindingRow (slug visible).
    expect(screen.getByText('IA-02').textContent).toContain('✗')
    expect(screen.getByText(/IAM\.10/)).toBeInTheDocument()
  })

  it('lists satisfied, non-satisfied, and failing ARS control IDs when the pipeline provides them', () => {
    render(
      <InsightsPanel
        payload={{
          ...fullPayload,
          ars_satisfied_controls: ['IA-01', 'IA-02(01)'],
          ars_not_satisfied_controls: ['IA-02(02)', 'IA-02(08)'],
          ars_failing_controls: ['AC-17'],
        }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /details/i }))
    // Satisfied controls render with a ✓; the failing one with a ✗.
    expect(screen.getByText('IA-01').textContent).toContain('✓')
    expect(screen.getByText('IA-02(01)').textContent).toContain('✓')
    expect(screen.getByText('AC-17').textContent).toContain('✗')
    // Non-satisfied controls render greyed with a neutral marker — NOT the red ✗.
    expect(screen.getByText('IA-02(02)').textContent).toContain('○')
    expect(screen.getByText('IA-02(02)').textContent).not.toContain('✗')
    expect(screen.getByText('IA-02(08)').textContent).toContain('○')
  })

  it('renders non-satisfied ARS controls even when the satisfied array is absent', () => {
    render(
      <InsightsPanel
        payload={{
          ...fullPayload,
          ars_not_satisfied_controls: ['IA-02(02)'],
        }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /details/i }))
    expect(screen.getByText('IA-02(02)').textContent).toContain('○')
  })

  it('drops non-string control IDs instead of throwing', () => {
    render(
      <InsightsPanel
        payload={{
          ...fullPayload,
          ars_satisfied_controls: [
            'IA-01',
            { bad: true },
            42,
          ] as unknown as string[],
        }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /details/i }))
    // The valid string still renders; the panel is not blanked.
    expect(screen.getByText('IA-01')).toBeInTheDocument()
    expect(screen.getByText('ZTMF Insights')).toBeInTheDocument()
  })

  it('shows the ARS Controls count with no chips when the control arrays are absent', () => {
    render(<InsightsPanel payload={fullPayload} />)
    fireEvent.click(screen.getByRole('button', { name: /details/i }))
    expect(screen.getByText(/4 of 4 satisfied/)).toBeInTheDocument()
    expect(screen.queryByText('IA-01')).not.toBeInTheDocument()
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

  it('degrades a malformed non-string text field instead of blanking the panel', () => {
    // evidence_sources arriving as an object would throw "Objects are not valid
    // as a React child"; asText coerces it so the panel stays intact.
    render(
      <InsightsPanel
        payload={{
          suggested_score: 2,
          evidence_sources: { bad: true } as unknown as string,
        }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /details/i }))
    expect(screen.getByText('ZTMF Insights')).toBeInTheDocument()
    expect(screen.getByText(/Based on:/)).toBeInTheDocument()
  })

  it('coerces a non-string finding field instead of throwing', () => {
    render(
      <InsightsPanel
        payload={{
          suggested_score: 2,
          findings: {
            sechub: [{ id: 'IAM.10', title: { x: 1 } as unknown as string }],
          },
        }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /details/i }))
    expect(screen.getByText(/IAM\.10/)).toBeInTheDocument()
    expect(screen.getByText('ZTMF Insights')).toBeInTheDocument()
  })
})

describe('severityStyle', () => {
  it('maps severities to red / amber / neutral', () => {
    for (const s of ['error', 'ERROR', 'high', 'critical']) {
      expect(severityStyle(s).fg).toBe('#b02a37') // red
    }
    for (const s of ['warning', 'medium', 'WARN']) {
      expect(severityStyle(s).fg).toBe('#b26a00') // amber
    }
    for (const s of ['low', 'powerup', 'anything', undefined]) {
      expect(severityStyle(s).fg).toBe('#666') // neutral
    }
  })
})

describe('severity help (findings)', () => {
  const withSeverity = (severity: string) => ({
    suggested_score: 1,
    findings: {
      hardenize: [{ id: 'X', title: 'A finding', severity }],
    },
  })

  it('adds an explanation tooltip on the powerup severity badge', () => {
    render(<InsightsPanel payload={withSeverity('powerup')} />)
    fireEvent.click(screen.getByRole('button', { name: /details/i }))
    expect(
      screen.getByLabelText(/powerup:.*recommended enhancement/i)
    ).toBeInTheDocument()
  })

  it('adds an explanation tooltip on the error severity badge', () => {
    render(<InsightsPanel payload={withSeverity('error')} />)
    fireEvent.click(screen.getByRole('button', { name: /details/i }))
    expect(screen.getByLabelText(/error:.*failing check/i)).toBeInTheDocument()
  })
})

describe('FindingRow resilience', () => {
  it('drops a null finding element instead of blanking the panel', () => {
    render(
      <InsightsPanel
        payload={{
          suggested_score: 1,
          findings: {
            sechub: [
              null as unknown as { id: string },
              { id: 'IAM.10', title: 'MFA should be enabled' },
            ],
          },
        }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /details/i }))
    expect(screen.getByText('IAM.10')).toBeInTheDocument()
    expect(screen.getByText('ZTMF Insights')).toBeInTheDocument()
  })
})

// The maturity score badge inside a source chip shows the tier WORD, not the
// bare number (a number next to a source name read as a finding count).
describe('ScoreBadge', () => {
  it('shows the maturity word in the source chip, not the numeric score', () => {
    render(
      <InsightsPanel
        payload={{
          suggested_score: 2,
          has_kion_data: true,
          kion_suggested_score: 2,
        }}
      />
    )
    // Kion (score 2) renders "Initial", not "2".
    expect(screen.getByText('Initial')).toBeInTheDocument()
    expect(screen.queryByText('2')).not.toBeInTheDocument()
  })
})

// The ARS-style pass/fail block: passing checks from `{source}_passing` (green
// ✓), failing from `findings.{source}` (red ✗), labeled by NIST tag with the
// slug + description in the hover.
describe('FeedCheckBlock (feed pass/fail checks)', () => {
  const kionPassFail: InsightPayload = {
    suggested_score: 1,
    has_kion_data: true,
    kion_suggested_score: 1,
    kion_passing: [
      {
        id: 'account-without-compliant-password-policy',
        nist_controls: 'IA-5',
        description: 'Password Policy',
        level: 1,
      },
      {
        id: 'root-account-without-mfa-enabled',
        nist_controls: 'AC-2',
        description: 'Root MFA',
        level: 1,
      },
      {
        id: 'iam-user-with-password-and-no-mfa',
        nist_controls: 'AC-2',
        description: 'User MFA',
        level: 1,
      },
    ],
    findings: {
      kion: [
        {
          id: 'iam-user-without-mfa-device-enabled',
          nist_controls: 'IA-2',
          description: 'MFA device',
        },
      ],
    },
  }

  const expand = () =>
    fireEvent.click(screen.getByRole('button', { name: /details/i }))

  it('renders "N of M checks passed" with one chip per check', () => {
    render(<InsightsPanel payload={kionPassFail} />)
    expand()
    expect(screen.getByText(/3 of 4 checks passed/)).toBeInTheDocument()
    // 3 passing (green ✓) + 1 failing (red ✗), labeled by NIST tag.
    expect(screen.getByText('IA-5').textContent).toContain('✓')
    expect(screen.getByText('IA-2').textContent).toContain('✗')
  })

  it('renders a chip per check even when a NIST tag repeats (distinct checks)', () => {
    render(<InsightsPanel payload={kionPassFail} />)
    expand()
    const ac2 = screen.getAllByText('AC-2')
    expect(ac2).toHaveLength(2)
    ac2.forEach((chip) => expect(chip.textContent).toContain('✓'))
  })

  it('folds pass/fail status into each chip accessible name (role=img so AT exposes it)', () => {
    render(<InsightsPanel payload={kionPassFail} />)
    expand()
    // Assert via getByRole+name (resolves the real accessible name) rather than
    // getByLabelText (reads the attribute directly) — the chip carries role=img
    // so the aria-label is actually announced, not silently dropped by AT.
    expect(
      screen.getByRole('img', {
        name: /account-without-compliant-password-policy.*Password Policy.*Passed/,
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', {
        name: /iam-user-without-mfa-device-enabled.*Failed/,
      })
    ).toBeInTheDocument()
  })

  it('pluralizes the header for a single check', () => {
    render(
      <InsightsPanel
        payload={{
          suggested_score: 1,
          kion_passing: [],
          findings: { kion: [{ id: 'x', nist_controls: 'AC-1' }] },
        }}
      />
    )
    expand()
    expect(screen.getByText(/0 of 1 check passed/)).toBeInTheDocument()
  })

  it('renders a header-only "0 of 0" for an empty passing array with no failures', () => {
    render(<InsightsPanel payload={{ suggested_score: 2, kion_passing: [] }} />)
    expand()
    expect(screen.getByText(/0 of 0 checks passed/)).toBeInTheDocument()
  })

  it('shows Kion as a chip block (uniform) even with no passing array, labeling failures as findings', () => {
    render(
      <InsightsPanel
        payload={{
          suggested_score: 1,
          has_kion_data: true,
          kion_suggested_score: 1,
          findings: {
            kion: [
              {
                id: 'iam-role-missing-permissions-boundary',
                nist_controls: 'AC-6-10',
                description: 'Permissions boundary',
              },
            ],
          },
        }}
      />
    )
    expand()
    // No fabricated pass count — labeled "N finding(s)" — but still the chip
    // block (NIST tag + ✗), NOT the old verbose FindingRow (slug is not body
    // text, only reachable via the chip's accessible name).
    expect(screen.getByText(/1 finding/)).toBeInTheDocument()
    expect(screen.queryByText(/checks? passed/)).not.toBeInTheDocument()
    expect(screen.getByText('AC-6-10').textContent).toContain('✗')
    expect(
      screen.queryByText('iam-role-missing-permissions-boundary')
    ).not.toBeInTheDocument()
  })

  it('renders SecurityHub as the block when its passing array ships', () => {
    render(
      <InsightsPanel
        payload={{
          suggested_score: 2,
          has_sechub_data: true,
          sechub_suggested_score: 2,
          sechub_passing: [
            { id: 'IAM.1', nist_controls: 'AC-3', description: 'x', level: 1 },
          ],
          findings: {
            sechub: [{ id: 'IAM.10', nist_controls: 'IA-2', description: 'y' }],
          },
        }}
      />
    )
    expand()
    expect(screen.getByText(/1 of 2 checks passed/)).toBeInTheDocument()
    expect(screen.getByText('AC-3').textContent).toContain('✓')
    expect(screen.getByText('IA-2').textContent).toContain('✗')
    // As a block the finding slug is not rendered as body text.
    expect(screen.queryByText('IAM.10')).not.toBeInTheDocument()
  })

  it('keeps SecurityHub on the FindingRow list until its passing array ships', () => {
    render(
      <InsightsPanel
        payload={{
          suggested_score: 1,
          findings: {
            sechub: [
              {
                id: 'IAM.10',
                title: 'MFA should be enabled',
                description: 'Enable MFA',
                severity: 'MEDIUM',
              },
            ],
          },
        }}
      />
    )
    expand()
    // No passing array → old FindingRow: slug + title visible as body text.
    expect(screen.getByText('IAM.10')).toBeInTheDocument()
    expect(screen.getByText('MFA should be enabled')).toBeInTheDocument()
    // Not the block — no "N of M checks passed" header for SecurityHub.
    expect(screen.queryByText(/checks? passed/)).not.toBeInTheDocument()
  })

  it('degrades when a passing array arrives as a non-array', () => {
    render(
      <InsightsPanel
        payload={{
          suggested_score: 1,
          has_kion_data: true,
          kion_suggested_score: 1,
          kion_passing: 'nope' as unknown as [],
          findings: { kion: [{ id: 'x', nist_controls: 'AC-1' }] },
        }}
      />
    )
    expand()
    // asFindingArray drops the bad value → treated as no passing checks; the
    // failing check still renders and the panel is not blanked.
    expect(screen.getByText('AC-1').textContent).toContain('✗')
    expect(screen.getByText('ZTMF Insights')).toBeInTheDocument()
  })
})
