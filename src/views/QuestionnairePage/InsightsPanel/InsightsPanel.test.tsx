import { render, screen, fireEvent } from '@testing-library/react'
import InsightsPanel, {
  OptionInsightBadges,
  severityStyle,
  rollupControls,
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
  it('renders the ZTMF Insights label and the four source chips', () => {
    render(<InsightsPanel payload={fullPayload} />)
    expect(screen.getByText('ZTMF Insights')).toBeInTheDocument()
    // Chips render the source name with a trailing colon (e.g. "Kion:"). ARS is
    // the control catalog (the "ARS Controls" section), not an evidence source —
    // its coverage rolls up under CFACTS, so there is no standalone ARS chip.
    for (const source of ['Kion', 'SecurityHub', 'Hardenize', 'CFACTS']) {
      expect(screen.getByText(`${source}:`)).toBeInTheDocument()
    }
    expect(screen.queryByText('ARS:')).not.toBeInTheDocument()
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
    // Hardenize is the remaining FindingRow source (Kion/SecurityHub now render as
    // the compact chip block), so the uniform card shape is asserted through it.
    render(
      <InsightsPanel
        payload={{
          suggested_score: 1,
          findings: {
            hardenize: [
              {
                id: 'WWW_HSTS_MISSING',
                title: 'HSTS not enabled',
                description: 'Enable HSTS on this host.',
                remediation: 'Send a Strict-Transport-Security header.',
                severity: 'MEDIUM',
              },
            ],
          },
        }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /details/i }))
    expect(screen.getByText('WWW_HSTS_MISSING')).toBeInTheDocument()
    expect(screen.getByText('HSTS not enabled')).toBeInTheDocument()
    // Description surfaces in the severity badge hover, not the card body.
    expect(
      screen.getByLabelText(/MEDIUM: Enable HSTS on this host\./)
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
              hardenize: [
                {
                  id: 'WWW_HSTS_MISSING',
                  title: 'HSTS not enabled',
                  remediation: 'Send a Strict-Transport-Security header.',
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
        screen.queryByText(/Strict-Transport-Security/)
      ).not.toBeInTheDocument()
      // ...but the finding itself and the CFACTS reasoning still render.
      expect(screen.getByText('WWW_HSTS_MISSING')).toBeInTheDocument()
      expect(screen.getByText('HSTS not enabled')).toBeInTheDocument()
      expect(screen.getByText(/IDM-Okta detected/)).toBeInTheDocument()
    } finally {
      CONFIG.INSIGHTS_SUGGEST_FIX_ENABLED = true
    }
  })

  it('hides findings until details is toggled, then reveals them', () => {
    render(<InsightsPanel payload={fullPayload} />)
    // Nothing in the drawer shows until expanded.
    expect(screen.queryByText(/IAM\.10/)).not.toBeInTheDocument()
    expect(
      screen.queryByText('iam-user-without-mfa-device-enabled')
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /details/i }))

    // Kion renders as its pass/fail chip block (failing chip labeled by the
    // finding name, ✗ — the NIST control moved into the hover); the sechub
    // finding renders as a FindingRow (slug visible).
    expect(
      screen.getByText('iam-user-without-mfa-device-enabled').textContent
    ).toContain('✗')
    expect(screen.getByText(/IAM\.10/)).toBeInTheDocument()
  })

  it('labels each Kion check by its finding name (green pass / red fail) with the description + control + state in the hover', async () => {
    render(
      <InsightsPanel
        payload={{
          suggested_score: 1,
          has_kion_data: true,
          findings: {
            kion: [
              {
                id: 'iam-user-without-mfa-device-enabled',
                nist_controls: 'IA-02',
                description: 'Identify IAM users without an MFA device enabled',
              },
            ],
          },
          kion_passing: [
            {
              id: 'iam-user-inactive',
              nist_controls: 'AC-2',
              description: 'Identify inactive IAM Users',
              level: 1,
            },
          ],
        }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /details/i }))

    // Chip label is the finding name itself, coloured by state: ✗ for a check
    // that has a finding (failing), ✓ for one with no finding (passing).
    const fail = screen.getByRole('img', {
      name: /^iam-user-without-mfa-device-enabled — .* — Failed$/,
    })
    const pass = screen.getByRole('img', {
      name: /^iam-user-inactive — .* — Passed$/,
    })
    expect(fail.textContent).toContain('✗')
    expect(fail.textContent).toContain('iam-user-without-mfa-device-enabled')
    expect(pass.textContent).toContain('✓')

    // Per-check rollup: 1 passing + 1 failing reads "1 of 2 checks passed".
    expect(screen.getByText(/1 of 2 checks passed/)).toBeInTheDocument()

    // The control now lives in the hover, not on the chip label.
    expect(fail.textContent).not.toContain('IA-02')

    // Hover/focus reveals the description, the mapped control, and met/failed —
    // the signal Mack asked to surface instead of a bare control tag.
    fireEvent.focus(fail)
    const tip = await screen.findByRole('tooltip')
    expect(tip).toHaveTextContent(
      'Identify IAM users without an MFA device enabled'
    )
    expect(tip).toHaveTextContent('Control: IA-02')
    expect(tip).toHaveTextContent('Failed')
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

  it('renders a control present in BOTH not-satisfied and failing once, as failing (arrays are not mutually exclusive)', () => {
    // The pipeline builds ars_not_satisfied_controls as a SUPERSET of
    // ars_failing_controls, so a flagged control (AC-17 here) arrives in both.
    // It must render exactly one chip, red ✗ failing — never a second grey ○.
    render(
      <InsightsPanel
        payload={{
          ...fullPayload,
          ars_satisfied_controls: ['IA-01'],
          ars_not_satisfied_controls: ['IA-02(02)', 'AC-17'],
          ars_failing_controls: ['AC-17'],
        }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /details/i }))
    // Exactly one AC-17 chip, and it is the failing (✗) one, not a grey ○.
    const ac17 = screen.getAllByText('AC-17')
    expect(ac17).toHaveLength(1)
    expect(ac17[0].textContent).toContain('✗')
    expect(ac17[0].textContent).not.toContain('○')
    // The genuinely-not-satisfied control still renders grey.
    expect(screen.getByText('IA-02(02)').textContent).toContain('○')
    // Accessible name reflects the failing net state, not merely not-satisfied.
    expect(
      screen.getByRole('img', { name: /^AC-17: failing/ })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('img', { name: /^AC-17: not satisfied/ })
    ).not.toBeInTheDocument()
  })

  it('gives each ARS control chip a plain-language state reason (role=img name = tooltip) for hover + AT', () => {
    render(
      <InsightsPanel
        payload={{
          ...fullPayload,
          ars_satisfied_controls: ['IA-01'],
          ars_not_satisfied_controls: ['IA-02(02)'],
          ars_failing_controls: ['AC-17'],
        }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /details/i }))
    // The chip's accessible name is "<id>: <net state>. <source · check · verb>…"
    // — the same evidence the Tooltip surfaces on hover — so the state and its
    // provenance reach a screen reader, not just the ✓/○/✗ marker and colour.
    expect(
      screen.getByRole('img', { name: /^IA-01: satisfied/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: /^IA-02\(02\): not satisfied/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: /^AC-17: failing/ })
    ).toBeInTheDocument()
  })

  it('makes each ARS control chip keyboard-focusable so its tooltip is not mouse-only (508)', async () => {
    render(
      <InsightsPanel
        payload={{ ...fullPayload, ars_satisfied_controls: ['IA-01'] }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /details/i }))
    const chip = screen.getByRole('img', { name: /^IA-01: satisfied/ })
    // Focusable, and the MUI Tooltip fires on focus (not just hover) so a
    // keyboard-only sighted user can read the per-source evidence.
    expect(chip).toHaveAttribute('tabindex', '0')
    fireEvent.focus(chip)
    expect(await screen.findByRole('tooltip')).toHaveTextContent(/CFACTS/)
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
    // The valid string renders; the non-string elements are dropped (not coerced
    // into junk "42" / "[object Object]" chips), and the panel is not blanked.
    expect(screen.getByText('IA-01')).toBeInTheDocument()
    expect(screen.queryByText('42')).not.toBeInTheDocument()
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument()
    expect(screen.getByText('ZTMF Insights')).toBeInTheDocument()
  })

  it('surfaces source-touched controls under "Aligns with ARS Controls", with no standalone count', () => {
    // fullPayload carries no ars_* arrays, but its Kion finding maps to IA-02 — the
    // union surfaces that control (failing) under the alignment section. There is no
    // "N of M satisfied" count (the union denominator is not the official ARS total).
    render(<InsightsPanel payload={fullPayload} />)
    fireEvent.click(screen.getByRole('button', { name: /details/i }))
    expect(screen.getByText('Aligns with ARS Controls:')).toBeInTheDocument()
    expect(screen.queryByText(/of \d+ satisfied/)).not.toBeInTheDocument()
    expect(screen.getByText('IA-02').textContent).toContain('✗')
    // A control no source touched does not appear.
    expect(screen.queryByText('IA-01')).not.toBeInTheDocument()
  })

  it('carries a keyboard-reachable disclaimer that alignment is not a control determination', async () => {
    render(<InsightsPanel payload={fullPayload} />)
    fireEvent.click(screen.getByRole('button', { name: /details/i }))
    // Short accessible name; the full compliance disclaimer rides in the tooltip.
    const info = screen.getByLabelText(/About ARS alignment/i)
    expect(info).toBeInTheDocument()
    // Focusable (508) and the tooltip fires on focus, not just hover.
    expect(info).toHaveAttribute('tabindex', '0')
    fireEvent.focus(info)
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      /does not constitute an assessed control satisfaction determination/i
    )
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      /CFACTS remains the system of record/
    )
  })

  it('orders the drawer with "Based on" first and the ARS alignment last', () => {
    render(<InsightsPanel payload={fullPayload} />)
    fireEvent.click(screen.getByRole('button', { name: /details/i }))
    const based = screen.getByText('Based on:')
    const aligns = screen.getByText('Aligns with ARS Controls:')
    // "Based on" leads the drawer; the control-union alignment sits at the bottom.
    expect(
      based.compareDocumentPosition(aligns) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('surfaces a control a Kion check passes in the ARS Controls union (SC-12)', () => {
    render(
      <InsightsPanel
        payload={
          {
            suggested_score: 1,
            kion_passing: [
              {
                id: 'kms-key-with-rotation-disabled',
                nist_controls: 'SC-12',
                level: 2,
              },
            ],
          } as unknown as InsightPayload
        }
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /details/i }))
    // SC-12 shows satisfied even though CFACTS never assessed it — the row is the
    // cross-source total, and Kion passed the check that maps to SC-12.
    expect(screen.getByText('SC-12').textContent).toContain('✓')
  })

  it('flags a control passed by one check and failed by another as an amber conflict, netting to failing, and names both sources on hover', async () => {
    render(
      <InsightsPanel
        payload={
          {
            suggested_score: 1,
            kion_passing: [
              { id: 'kms-key-with-rotation-disabled', nist_controls: 'SC-12' },
            ],
            findings: {
              kion: [
                {
                  id: 'kms-key-with-cross-account-access',
                  nist_controls: 'SC-12',
                },
              ],
            },
          } as unknown as InsightPayload
        }
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /details/i }))
    // Amber ⚠ conflict chip — not a plain ✓ or ✗ — so the disagreement is visible.
    const chip = screen.getByRole('img', { name: /^SC-12: sources disagree/ })
    expect(chip.textContent).toContain('⚠')
    // Hover names each source + check and states how the score resolved it.
    fireEvent.focus(chip)
    const tip = await screen.findByRole('tooltip')
    expect(tip).toHaveTextContent('kms-key-with-rotation-disabled')
    expect(tip).toHaveTextContent('kms-key-with-cross-account-access')
    expect(tip).toHaveTextContent(/counted as failing/)
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
          has_kion_data: true,
          findings: { kion: 'not-an-array' as unknown as [] },
        }}
      />
    )
    expect(screen.getByText('ZTMF Insights')).toBeInTheDocument()
    // The malformed findings block is skipped, not thrown on. The panel still
    // renders, and "Based on" is derived from the active source chips.
    fireEvent.click(screen.getByRole('button', { name: /details/i }))
    expect(screen.getByText(/Based on:/)).toBeInTheDocument()
  })

  it('degrades a malformed non-string text field instead of blanking the panel', () => {
    // A field arriving as an object would throw "Objects are not valid as a React
    // child"; asText coerces it so the panel stays intact.
    render(
      <InsightsPanel
        payload={{
          suggested_score: 2,
          has_kion_data: true,
          cfacts_reasoning: { bad: true } as unknown as string,
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

describe('rollupControls (cross-source ARS control union)', () => {
  const roll = (p: unknown) => rollupControls(p as InsightPayload)

  it('unions a Kion passing check control into satisfied with no CFACTS arrays', () => {
    expect(
      roll({
        kion_passing: [
          { id: 'kms-rotation', nist_controls: 'SC-12', level: 2 },
        ],
      })
    ).toEqual([
      {
        id: 'SC-12',
        state: 'satisfied',
        conflict: false,
        evidence: [
          { source: 'Kion', check: 'kms-rotation', state: 'satisfied' },
        ],
      },
    ])
  })

  it('nets weakest-link across sources: a SecHub fail overrides a CFACTS satisfied (and flags conflict)', () => {
    const rolled = roll({
      ars_satisfied_controls: ['AC-2'],
      ars_not_satisfied_controls: ['AC-3'],
      findings: { sechub: [{ id: 'EC2.10', nist_controls: 'AC-2' }] },
    })
    const map = Object.fromEntries(rolled.map((c) => [c.id, c.state]))
    expect(map['AC-2']).toBe('failing')
    expect(map['AC-3']).toBe('unsatisfied')
    // AC-2 is satisfied by CFACTS but failed by SecHub → conflict (amber ⚠), not a
    // plain red fail.
    expect(rolled.find((c) => c.id === 'AC-2')?.conflict).toBe(true)
  })

  it('flags pass+fail on the same control as a conflict that nets to failing', () => {
    const sc12 = roll({
      kion_passing: [{ id: 'rot', nist_controls: 'SC-12' }],
      findings: { kion: [{ id: 'xacct', nist_controls: 'SC-12' }] },
    }).find((c) => c.id === 'SC-12')
    expect(sc12).toMatchObject({ state: 'failing', conflict: true })
    expect(sc12?.evidence).toHaveLength(2)
  })

  it('splits a multi-control mapping and skips malformed evidence without throwing', () => {
    const rolled = roll({
      findings: {
        kion: [
          { id: 'x', nist_controls: 'AC-2, AC-3' },
          null,
          { id: 'no-control' },
        ],
      },
    })
    expect(rolled.map((c) => c.id).sort()).toEqual(['AC-2', 'AC-3'])
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
    // 3 passing (green ✓) + 1 failing (red ✗), each labeled by its check name.
    expect(
      screen.getByText('account-without-compliant-password-policy').textContent
    ).toContain('✓')
    expect(
      screen.getByText('iam-user-without-mfa-device-enabled').textContent
    ).toContain('✗')
  })

  it('renders a chip per check even when two checks map to the same control', () => {
    render(<InsightsPanel payload={kionPassFail} />)
    expand()
    // Two distinct checks share control AC-2; each still gets its own feed chip
    // (labeled by check name)…
    expect(
      screen.getByText('root-account-without-mfa-enabled').textContent
    ).toContain('✓')
    expect(
      screen.getByText('iam-user-with-password-and-no-mfa').textContent
    ).toContain('✓')
    // …while the ARS Controls union collapses AC-2 to a single control chip.
    expect(screen.getAllByText('AC-2')).toHaveLength(1)
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
    // No fabricated pass count — labeled "N finding(s)" — but still the chip block
    // (finding name + ✗), NOT the old verbose FindingRow.
    expect(screen.getByText(/1 finding/)).toBeInTheDocument()
    expect(screen.queryByText(/checks? passed/)).not.toBeInTheDocument()
    expect(
      screen.getByText('iam-role-missing-permissions-boundary').textContent
    ).toContain('✗')
    // The control it maps to also surfaces in the ARS Controls union.
    expect(screen.getByText('AC-6-10').textContent).toContain('✗')
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
    // Feed chips are labeled by the SecurityHub finding code.
    expect(screen.getByText('IAM.1').textContent).toContain('✓')
    expect(screen.getByText('IAM.10').textContent).toContain('✗')
  })

  it('renders SecurityHub as a chip block even with only failing findings', () => {
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
                nist_controls: 'IA-2',
              },
            ],
          },
        }}
      />
    )
    expand()
    // One "SecurityHub:" header + a chip labeled by the finding code (✗) — the
    // compact block, not the old per-finding FindingRow list.
    expect(screen.getByText(/1 finding/)).toBeInTheDocument()
    expect(screen.getByText('IAM.10').textContent).toContain('✗')
    // Title lives in the hover now, not as body text.
    expect(screen.queryByText('MFA should be enabled')).not.toBeInTheDocument()
  })

  it('collapses the passing bulk behind a toggle, keeps failing chips at the top, and expands on click', () => {
    const passing = Array.from({ length: 9 }, (_, i) => ({
      id: `pass-check-${i}`,
      nist_controls: 'SC-7',
      level: 1,
    }))
    render(
      <InsightsPanel
        payload={
          {
            suggested_score: 2,
            has_hardenize_data: true,
            hardenize_passing: passing,
            findings: {
              hardenize: [
                { id: 'fail-check', nist_controls: 'SC-8', severity: 'error' },
              ],
            },
          } as unknown as InsightPayload
        }
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /details/i }))
    // Failing chip shown at the top; the 9 passing checks are collapsed away.
    expect(screen.getByText('fail-check').textContent).toContain('✗')
    expect(screen.queryByText('pass-check-0')).not.toBeInTheDocument()
    // Toggle reveals them.
    fireEvent.click(
      screen.getByRole('button', { name: /Show all 9 passing checks/i })
    )
    expect(screen.getByText('pass-check-0')).toBeInTheDocument()
    // Failing still precedes the passing chips in the DOM.
    const fail = screen.getByText('fail-check')
    const pass0 = screen.getByText('pass-check-0')
    expect(
      fail.compareDocumentPosition(pass0) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('renders Hardenize as chips when its passing array ships, keeping affected domains in the hover', async () => {
    render(
      <InsightsPanel
        payload={
          {
            suggested_score: 2,
            has_hardenize_data: true,
            hardenize_passing: [
              {
                id: 'DNS_DANGLING',
                nist_controls: 'SC-7',
                description: 'No dangling DNS records',
                level: 1,
              },
            ],
            findings: {
              hardenize: [
                {
                  id: 'WWW_CERT_HOST_MISMATCH',
                  title: "Certificate doesn't match hostname",
                  severity: 'error',
                  nist_controls: 'SC-8',
                  instances: [
                    { domain: 'idm.cms.gov', detail: 'cert CN mismatch' },
                  ],
                },
              ],
            },
          } as unknown as InsightPayload
        }
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /details/i }))
    // Passing array present → Hardenize flips to the same green/red chip block as
    // Kion/SecurityHub (not the FindingRow list).
    expect(screen.getByText('DNS_DANGLING').textContent).toContain('✓')
    const fail = screen.getByRole('img', {
      name: /^WWW_CERT_HOST_MISMATCH — .* — Failed$/,
    })
    expect(fail.textContent).toContain('✗')
    // Affected domains ride along in the chip hover so nothing is lost vs FindingRow.
    fireEvent.focus(fail)
    const tip = await screen.findByRole('tooltip')
    expect(tip).toHaveTextContent('idm.cms.gov')
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

describe('FIPS baseline strip', () => {
  it('shows the FIPS badge + baseline sentence for a system with headroom (Low → Initial)', () => {
    render(
      <InsightsPanel
        payload={{
          suggested_score: 2,
          fips_impact_level: 'Low',
          fips_ceiling: 2,
        }}
      />
    )
    expect(screen.getByText('FIPS LOW')).toBeInTheDocument()
    expect(screen.getByText(/Baseline for this system is/)).toBeInTheDocument()
    expect(screen.getByText('Initial')).toBeInTheDocument()
  })

  it('hides the strip when there is no headroom (High / ceiling 4)', () => {
    render(
      <InsightsPanel
        payload={{
          suggested_score: 4,
          fips_impact_level: 'High',
          fips_ceiling: 4,
        }}
      />
    )
    expect(screen.queryByText(/FIPS/)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Baseline for this system is/)
    ).not.toBeInTheDocument()
  })

  it('does not throw or render the strip for a malformed (non-string) impact level', () => {
    render(
      <InsightsPanel
        payload={{
          suggested_score: 2,
          fips_impact_level: 3 as unknown as 'Low',
          fips_ceiling: 2,
        }}
      />
    )
    // Panel still renders; strip is suppressed rather than crashing.
    expect(screen.getByText('ZTMF Insights')).toBeInTheDocument()
    expect(
      screen.queryByText(/Baseline for this system is/)
    ).not.toBeInTheDocument()
  })
})
