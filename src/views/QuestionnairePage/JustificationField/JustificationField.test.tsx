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

function Harness() {
  const initial = insight.last_score_notes ?? ''
  const [value, setValue] = React.useState(initial)
  const [review, setReview] = React.useState<PriorReviewState>('pending')
  return (
    <JustificationField
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
    fireEvent.click(screen.getByRole('button', { name: 'Review again' }))
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

    fireEvent.click(screen.getByRole('button', { name: 'Review again' }))
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Insert suggested justification into current response',
      })
    )

    expect((textbox as HTMLTextAreaElement).value).toContain(
      'CFACTS (2): IDM-Okta.'
    )
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

    fireEvent.click(screen.getByRole('button', { name: 'Review again' }))

    expect(screen.getByText(insight.last_score_notes ?? '')).toBeInTheDocument()
  })

  it('only shows the expansion control when context text is clipped', () => {
    render(<Harness />)
    expect(
      screen.queryByRole('button', { name: 'Show all' })
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

    expect(screen.getByRole('button', { name: 'Show all' })).toBeInTheDocument()
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
