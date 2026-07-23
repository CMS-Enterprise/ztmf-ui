import * as React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import type { InsightPayload } from '@/types'
import JustificationField, { PriorReviewState } from './JustificationField'
import {
  buildInsightJustification,
  priorResponseFor,
} from './justificationContext'

const insight: InsightPayload = {
  suggested_score: 1,
  suggested_label: 'Traditional',
  cfacts_suggested_score: 2,
  cfacts_auth_methods: 'IDM-Okta',
  kion_suggested_score: 1,
  sechub_suggested_score: 1,
  ars_control_score: 2,
  ars_controls_satisfied: 4,
  ars_controls_total: 4,
  last_score_notes: 'MFA is enforced through Okta policies.',
  last_datacall: 'FY2025 Q1',
  findings: {
    kion: [{ id: 'one' }, { id: 'two' }],
    sechub: [{ id: 'one' }],
  },
}

function Harness({
  contextId = 'system-1003:question-1',
}: {
  contextId?: string
}) {
  const initial = insight.last_score_notes ?? ''
  const [value, setValue] = React.useState(initial)
  const [review, setReview] = React.useState<PriorReviewState>('pending')
  return (
    <JustificationField
      contextId={contextId}
      label="Explain the available authentication options"
      value={value}
      onChange={setValue}
      insight={insight}
      viewedDatacall="FY2025 Q2"
      priorReviewState={review}
      onPriorReview={setReview}
      maxLength={2000}
    />
  )
}

describe('justification context helpers', () => {
  it('builds a concise source-attributed Insights suggestion', () => {
    expect(buildInsightJustification(insight)).toBe(
      'CFACTS (2): IDM-Okta. Kion (1): 2 failing checks. SecurityHub (1): 1 failing control. ARS (2): 4/4 controls satisfied.'
    )
  })

  it('renders the prompt as an h2 so the heading order stays sequential under the question h1 (508)', () => {
    render(<Harness />)
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Explain the available authentication options',
      })
    ).toBeInTheDocument()
  })

  it('prefers a pipeline-authored suggested justification', () => {
    expect(
      buildInsightJustification({
        ...insight,
        suggested_justification: 'Use the approved MFA language.',
      })
    ).toBe('Use the approved MFA language.')
  })

  it('does not label the viewed data call as a previous response', () => {
    expect(priorResponseFor(insight, 'FY2025_Q1')).toBeUndefined()
  })

  it("labels prior content as last year's response", () => {
    expect(priorResponseFor(insight, 'FY2025 Q2')).toEqual({
      label: "Last year's response — FY2025 Q1",
      text: insight.last_score_notes,
    })
    expect(
      priorResponseFor({ last_score_notes: insight.last_score_notes })
    ).toEqual({
      label: "Last year's ISSO response",
      text: insight.last_score_notes,
    })
  })
})

describe('JustificationField', () => {
  it('keeps carried-forward text out of the current response until accepted', () => {
    render(<Harness />)
    const textbox = screen.getByRole('textbox', { name: 'Current response' })
    expect(textbox).toHaveValue('')
    expect(textbox).not.toHaveAttribute('readonly')
    expect(textbox.closest('.MuiTextField-root')).toHaveStyle({
      flex: '0 0 160px',
      height: '160px',
    })
    expect(screen.getByText('Review required')).toBeInTheDocument()
    expect(
      screen.getByText('Only the text in this field will be submitted.')
    ).toBeInTheDocument()
  })

  it('copies the previous response into the submitted field after acceptance', () => {
    render(<Harness />)
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Insert previous ISSO response into current response',
      })
    )
    expect(
      screen.getByRole('textbox', { name: 'Current response' })
    ).toHaveValue(insight.last_score_notes)
    expect(screen.getByText('Added to response')).toBeInTheDocument()
    expect(
      screen.queryByText('Review the previous response before continuing.')
    ).not.toBeInTheDocument()
  })

  it('preserves a typed response when the ISSO declines the previous response', () => {
    render(<Harness />)
    const textbox = screen.getByRole('textbox', { name: 'Current response' })
    fireEvent.change(textbox, {
      target: { value: 'The current call uses phishing-resistant MFA.' },
    })
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Dismiss previous ISSO response',
      })
    )
    expect(textbox).toHaveValue('The current call uses phishing-resistant MFA.')
    expect(screen.getByText('Not used')).toBeInTheDocument()
  })

  it('appends the previous response without overwriting current input', () => {
    render(<Harness />)
    const textbox = screen.getByRole('textbox', { name: 'Current response' })
    fireEvent.change(textbox, {
      target: { value: 'Current-call update.' },
    })
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Insert previous ISSO response into current response',
      })
    )
    expect(textbox).toHaveValue(
      `Current-call update.\n\n${insight.last_score_notes}`
    )
    expect(screen.getByText('Added to response')).toBeInTheDocument()
  })

  it('adds the Insights suggestion without silently submitting it', () => {
    const { unmount } = render(<Harness />)
    const textbox = screen.getByRole('textbox', { name: 'Current response' })
    expect(textbox).toHaveValue('')
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Insert previous ISSO response into current response',
      })
    )
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Insert suggested justification into current response',
      })
    )
    expect((textbox as HTMLTextAreaElement).value).toContain(
      'CFACTS (2): IDM-Okta.'
    )
    unmount()
  })

  it('lets the ISSO reopen a dismissed Insights suggestion', () => {
    render(<Harness />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss suggested justification' })
    )
    expect(screen.getByText('Not used')).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Review again: Suggested justification',
      })
    )
    expect(screen.getByText(/CFACTS \(2\): IDM-Okta\./)).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Insert suggested justification into current response',
      })
    ).toBeInTheDocument()
  })

  it('lets the ISSO reopen and re-add an accepted Insights suggestion', () => {
    render(<Harness />)
    const textbox = screen.getByRole('textbox', { name: 'Current response' })
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Insert suggested justification into current response',
      })
    )
    fireEvent.change(textbox, { target: { value: '' } })
    expect(screen.getByText('Not used')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Review again: Suggested justification',
      })
    )
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Insert suggested justification into current response',
      })
    )

    expect((textbox as HTMLTextAreaElement).value).toContain(
      'CFACTS (2): IDM-Okta.'
    )
  })

  it('disables reinserting an Insights suggestion that is still present', () => {
    render(<Harness />)
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Insert suggested justification into current response',
      })
    )
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Review again: Suggested justification',
      })
    )

    expect(
      screen.getByRole('button', {
        name: 'Insert suggested justification into current response',
      })
    ).toBeDisabled()
    expect(
      screen.getByText('Already included in the current response.')
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Close suggested justification review',
      })
    )
    expect(screen.getByText('Added to response')).toBeInTheDocument()
    expect(
      (
        screen.getByRole('textbox', {
          name: 'Current response',
        }) as HTMLTextAreaElement
      ).value
    ).toContain('CFACTS (2): IDM-Okta.')
  })

  it('keeps an edited Insights suggestion marked as added', () => {
    render(<Harness />)
    const textbox = screen.getByRole('textbox', { name: 'Current response' })
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Insert suggested justification into current response',
      })
    )
    fireEvent.change(textbox, {
      target: {
        value: (textbox as HTMLTextAreaElement).value.replace(
          'IDM-Okta.',
          'IDM-Okta with phishing-resistant MFA.'
        ),
      },
    })

    expect(screen.getByText('Added to response')).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Review again: Suggested justification',
      })
    )
    expect(
      screen.getByRole('button', {
        name: 'Close suggested justification review',
      })
    ).toBeInTheDocument()
  })

  it('lets the ISSO reopen an accepted previous response', () => {
    render(<Harness />)
    const textbox = screen.getByRole('textbox', { name: 'Current response' })
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Insert previous ISSO response into current response',
      })
    )
    fireEvent.change(textbox, { target: { value: '' } })
    expect(screen.getByText('Not used')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', {
        name: "Review again: Last year's response — FY2025 Q1",
      })
    )

    expect(screen.getByText(insight.last_score_notes ?? '')).toBeInTheDocument()
  })

  it('disables reinserting a reviewed previous response that is still present', () => {
    render(<Harness />)
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Insert previous ISSO response into current response',
      })
    )
    fireEvent.click(
      screen.getByRole('button', {
        name: "Review again: Last year's response — FY2025 Q1",
      })
    )

    expect(
      screen.getByRole('button', {
        name: 'Insert previous ISSO response into current response',
      })
    ).toBeDisabled()
    expect(
      screen.getByText('Already included in the current response.')
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Close previous ISSO response review',
      })
    )
    expect(screen.getByText('Added to response')).toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: 'Current response' })
    ).toHaveValue(insight.last_score_notes)
  })

  it('keeps an edited previous response marked as added', () => {
    render(<Harness />)
    const textbox = screen.getByRole('textbox', { name: 'Current response' })
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Insert previous ISSO response into current response',
      })
    )
    fireEvent.change(textbox, {
      target: {
        value: (insight.last_score_notes ?? '').replace(
          'Okta policies.',
          'phishing-resistant Okta policies.'
        ),
      },
    })

    expect(screen.getByText('Added to response')).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', {
        name: "Review again: Last year's response — FY2025 Q1",
      })
    )
    expect(
      screen.getByRole('button', {
        name: 'Close previous ISSO response review',
      })
    ).toBeInTheDocument()
  })

  it('marks only the removed source as not used when other text remains', () => {
    render(<Harness />)
    const textbox = screen.getByRole('textbox', { name: 'Current response' })
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Insert previous ISSO response into current response',
      })
    )
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Insert suggested justification into current response',
      })
    )

    fireEvent.change(textbox, { target: { value: insight.last_score_notes } })

    expect(screen.getByText('Not used')).toBeInTheDocument()
    expect(screen.getByText('Added to response')).toBeInTheDocument()
  })

  it('resets card state when the question context changes', () => {
    const { rerender } = render(<Harness contextId="question-1" />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss suggested justification' })
    )
    expect(screen.getByText('Not used')).toBeInTheDocument()

    rerender(<Harness contextId="question-2" />)

    expect(
      screen.getByRole('button', { name: 'Dismiss suggested justification' })
    ).toBeInTheDocument()
    expect(screen.getByText(/CFACTS \(2\): IDM-Okta\./)).toBeInTheDocument()
  })

  it('blocks editing while previous-response review is initializing', () => {
    render(
      <JustificationField
        contextId="question-1"
        label="Justification"
        value={insight.last_score_notes ?? ''}
        onChange={jest.fn()}
        insight={insight}
        viewedDatacall="FY2025 Q2"
        priorReviewState="initializing"
        onPriorReview={jest.fn()}
        maxLength={2000}
      />
    )

    expect(
      screen.getByRole('textbox', { name: 'Current response' })
    ).toBeDisabled()
    expect(
      screen.getByText('Checking the previous response…')
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: 'Insert previous ISSO response into current response',
      })
    ).not.toBeInTheDocument()
  })

  it('only shows the expansion control when context text is clipped', () => {
    render(<Harness />)
    expect(
      screen.queryByRole('button', {
        name: 'Show all: Suggested justification',
      })
    ).not.toBeInTheDocument()

    const suggestion = screen.getByText(/CFACTS \(2\): IDM-Okta\./)
    Object.defineProperty(suggestion, 'clientHeight', {
      configurable: true,
      value: 32,
    })
    Object.defineProperty(suggestion, 'scrollHeight', {
      configurable: true,
      value: 64,
    })
    fireEvent(window, new Event('resize'))

    expect(
      screen.getByRole('button', {
        name: 'Show all: Suggested justification',
      })
    ).toBeInTheDocument()
  })

  it('keeps repeated compact actions source-specific for assistive technology', () => {
    render(<Harness />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss suggested justification' })
    )
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Dismiss previous ISSO response',
      })
    )

    expect(
      screen.getByRole('button', {
        name: 'Review again: Suggested justification',
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: "Review again: Last year's response — FY2025 Q1",
      })
    ).toBeInTheDocument()
  })

  it('explains when contextual text cannot fit in the current response', () => {
    render(
      <JustificationField
        label="Justification"
        value={'x'.repeat(1990)}
        onChange={jest.fn()}
        insight={insight}
        viewedDatacall="FY2025 Q2"
        priorReviewState="not-required"
        onPriorReview={jest.fn()}
        maxLength={2000}
      />
    )

    expect(
      screen.getByRole('button', {
        name: 'Insert suggested justification into current response',
      })
    ).toBeDisabled()
    expect(
      screen.getByText('Not enough space remaining to insert this suggestion.')
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Not enough space remaining to insert the previous response.'
      )
    ).toBeInTheDocument()
  })

  it('shows context without action buttons in read-only mode', () => {
    render(
      <JustificationField
        label="Justification"
        value="Saved response"
        onChange={jest.fn()}
        insight={insight}
        viewedDatacall="FY2025 Q2"
        priorReviewState="not-required"
        onPriorReview={jest.fn()}
        maxLength={2000}
        disabled
      />
    )
    expect(
      screen.queryByRole('button', {
        name: 'Insert suggested justification into current response',
      })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: 'Current response' })
    ).toBeDisabled()
  })
})
