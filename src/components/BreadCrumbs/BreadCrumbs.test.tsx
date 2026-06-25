import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BreadCrumbs from './BreadCrumbs'

function renderAt(pathname: string, segmentLabels?: Record<string, string>) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <BreadCrumbs segmentLabels={segmentLabels} />
    </MemoryRouter>
  )
}

describe('BreadCrumbs', () => {
  it('renders Dashboard root link', () => {
    renderAt('/questionnaire/aco-ms')
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('capitalizes lowercase segments and replaces hyphen with space by default', () => {
    renderAt('/questionnaire/aco-ms')
    // 'aco-ms' becomes 'Aco ms' — the case that prompted the segmentLabels
    // override on the questionnaire page.
    expect(screen.getByText('Aco ms')).toBeInTheDocument()
  })

  it('passes through segments that already start uppercase', () => {
    renderAt('/questionnaire/aco-ms/FY2026_Q1')
    expect(screen.getByText('FY2026 Q1')).toBeInTheDocument()
  })

  it('honors segmentLabels override and preserves casing/hyphens', () => {
    renderAt('/questionnaire/aco-ms/FY2026_Q1', { 'aco-ms': 'ACO-MS' })
    expect(screen.getByText('ACO-MS')).toBeInTheDocument()
    expect(screen.queryByText('Aco ms')).not.toBeInTheDocument()
  })

  it('renders Dashboard as plain text on root path', () => {
    renderAt('/')
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('decodes percent-encoded segments before displaying', () => {
    renderAt('/questionnaire/Acumen%20gss')
    expect(screen.getByText('Acumen gss')).toBeInTheDocument()
    expect(screen.queryByText(/Acumen%20gss/)).not.toBeInTheDocument()
  })

  it('matches segmentLabels against decoded keys', () => {
    renderAt('/questionnaire/acumen%20gss', { 'acumen gss': 'ACUMEN-GSS' })
    expect(screen.getByText('ACUMEN-GSS')).toBeInTheDocument()
  })
})
