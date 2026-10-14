import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BreadCrumbs from './BreadCrumbs'

function renderAt(
  pathname: string,
  segmentLabels?: Record<string, string>,
  segmentLinks?: Record<string, string>
) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <BreadCrumbs segmentLabels={segmentLabels} segmentLinks={segmentLinks} />
    </MemoryRouter>
  )
}

/** The trail as rendered, in order, links and plain crumbs alike. */
function crumbText(): string[] {
  return within(screen.getByLabelText('breadcrumb'))
    .getAllByRole('listitem')
    .map((li) => li.textContent?.trim() ?? '')
    .filter((t) => t && t !== '/')
}

describe('BreadCrumbs', () => {
  it('roots the trail at a Dashboard link, not a "Home" page that does not exist', () => {
    renderAt('/questionnaire/aco-ms')
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/'
    )
    expect(screen.queryByText('Home')).not.toBeInTheDocument()
  })

  it('capitalizes lowercase segments and replaces hyphen with space by default', () => {
    renderAt('/questionnaire/aco-ms')
    // 'aco-ms' becomes 'Aco ms' - the case that prompted the segmentLabels
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

  it('shows only "Dashboard", as plain text, on the dashboard itself', () => {
    renderAt('/')
    expect(screen.getAllByText('Dashboard')).toHaveLength(1)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('reads the admin tabs like the other top-level tabs', () => {
    // /admin names no page, so OpDivs reads "Dashboard / OpDivs" like Users.
    renderAt('/admin/opdivs')
    expect(screen.getByText('OpDivs')).toBeInTheDocument()
    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
  })

  it('decodes percent-encoded segments before displaying', () => {
    renderAt('/questionnaire/Acumen%20gss')
    expect(screen.getByText('Acumen gss')).toBeInTheDocument()
    expect(screen.queryByText(/Acumen%20gss/)).not.toBeInTheDocument()
  })

  it('uses the product casing for fixed route segments', () => {
    // capitalize() alone would lowercase the D and read "Opdivs".
    renderAt('/admin/opdivs')
    expect(screen.getByText('OpDivs')).toBeInTheDocument()
    expect(screen.queryByText('Opdivs')).not.toBeInTheDocument()
  })

  it("skips the questionnaire route's fixed system segment", () => {
    renderAt('/questionnaire/system/1001/FY2026_Q1', { '1001': 'DS-1' })
    expect(screen.getByText('Questionnaire')).toBeInTheDocument()
    expect(screen.getByText('DS-1')).toBeInTheDocument()
    expect(screen.queryByText('System')).not.toBeInTheDocument()
  })

  it('keeps a system segment anywhere other than right after questionnaire', () => {
    renderAt('/questionnaire/system/1001/data/system')
    expect(screen.getByText('System')).toBeInTheDocument()
  })

  it('links a crumb to the page the caller names', () => {
    renderAt(
      '/systems/1002/pillar-scores',
      { '1002': 'Super Star Destroyer' },
      { '1002': '/systems/1002' }
    )
    expect(
      screen.getByRole('link', { name: 'Super Star Destroyer' })
    ).toHaveAttribute('href', '/systems/1002')
    // `systems` names no page and gets no crumb at all now, linked or not.
    expect(screen.queryByText('Systems')).not.toBeInTheDocument()
  })

  it('drops the systems segment, which names no page the Dashboard is not', () => {
    renderAt('/systems/1002/pillar-scores', { '1002': 'Super Star Destroyer' })
    expect(crumbText()).toEqual([
      'Dashboard',
      'Super Star Destroyer',
      'Pillar scores',
    ])
  })

  it('keeps the questionnaire segment, the only crumb naming the page', () => {
    // /questionnaire alone has no route either, but dropping it leaves the
    // trail with nothing saying what the user is looking at.
    renderAt('/questionnaire/system/1002/FY26_ZTM/identity', {
      '1002': 'SSD-EX',
    })
    expect(crumbText()).toEqual([
      'Dashboard',
      'Questionnaire',
      'SSD-EX',
      'FY26 ZTM',
      'Identity',
    ])
  })

  it('never links the last crumb and marks it as the current page', () => {
    renderAt(
      '/systems/1002',
      { '1002': 'Super Star Destroyer' },
      { '1002': '/systems/1002' }
    )
    expect(
      screen.queryByRole('link', { name: 'Super Star Destroyer' })
    ).not.toBeInTheDocument()
    expect(screen.getByText('Super Star Destroyer')).toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  it('matches segmentLabels against decoded keys', () => {
    renderAt('/questionnaire/acumen%20gss', { 'acumen gss': 'ACUMEN-GSS' })
    expect(screen.getByText('ACUMEN-GSS')).toBeInTheDocument()
  })

  it('applies an override to the first matching segment only', () => {
    // System 5 answering data call 5: the id repeats, and only the system
    // segment is the caller's to relabel and link.
    renderAt(
      '/questionnaire/system/5/5/identity/authentication',
      { '5': 'ACME' },
      { '5': '/systems/5' }
    )
    const links = screen.getAllByRole('link')
    expect(links.map((a) => a.textContent)).toEqual(['Dashboard', 'ACME'])
    expect(screen.getByRole('link', { name: 'ACME' })).toHaveAttribute(
      'href',
      '/systems/5'
    )
    expect(screen.getAllByText('ACME')).toHaveLength(1)
    expect(screen.getByText('5')).toBeInTheDocument()
  })
})
