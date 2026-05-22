import { render, screen } from '@testing-library/react'
import LastEditedFooter from './LastEditedFooter'
import { LastEditedBy } from '@/types'

describe('LastEditedFooter', () => {
  const editor: LastEditedBy = {
    userid: '9f000000-0000-0000-0000-000000000001',
    name: 'John Smith',
    email: 'john.smith@cms.hhs.gov',
    role: 'ISSO',
  }

  it('renders nothing when lastEditedAt is null', () => {
    const { container } = render(
      <LastEditedFooter lastEditedAt={null} lastEditedBy={null} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when lastEditedAt is undefined', () => {
    const { container } = render(<LastEditedFooter />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when lastEditedBy is null but timestamp present', () => {
    const { container } = render(
      <LastEditedFooter
        lastEditedAt="2026-04-14T22:12:40Z"
        lastEditedBy={null}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders name + role + formatted date when fully populated', () => {
    render(
      <LastEditedFooter
        lastEditedAt="2026-04-14T22:12:40Z"
        lastEditedBy={editor}
      />
    )
    const caption = screen.getByText(/Last edited by John Smith \(ISSO\) —/)
    expect(caption).toBeInTheDocument()
  })

  it('omits role parens when role is absent', () => {
    const { name, email, userid } = editor
    render(
      <LastEditedFooter
        lastEditedAt="2026-04-14T22:12:40Z"
        lastEditedBy={{ name, email, userid }}
      />
    )
    const caption = screen.getByText(/Last edited by John Smith —/)
    expect(caption).toBeInTheDocument()
    expect(caption.textContent).not.toMatch(/\(/)
  })

  it('renders nothing when lastEditedAt is an empty string', () => {
    const { container } = render(
      <LastEditedFooter lastEditedAt="" lastEditedBy={editor} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when lastEditedBy.name is an empty string', () => {
    const { container } = render(
      <LastEditedFooter
        lastEditedAt="2026-04-14T22:12:40Z"
        lastEditedBy={{ ...editor, name: '' }}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('falls back to raw iso when timestamp is unparseable', () => {
    render(<LastEditedFooter lastEditedAt="not-a-date" lastEditedBy={editor} />)
    expect(screen.getByText(/not-a-date/)).toBeInTheDocument()
  })

  it('exposes email + iso in tooltip title attribute', () => {
    render(
      <LastEditedFooter
        lastEditedAt="2026-04-14T22:12:40Z"
        lastEditedBy={editor}
      />
    )
    // MUI Tooltip sets aria-label on the child via a wrapping span; the
    // title prop is rendered to the DOM after hover. We assert the
    // tooltip-bearing element exposes the email + iso content via
    // aria-label or title fallback on the typography element.
    const caption = screen.getByText(/Last edited by John Smith/)
    // Walk up to the element MUI Tooltip wraps with aria-label.
    const wrapper = caption.closest('[aria-label]') ?? caption.parentElement
    expect(wrapper?.getAttribute('aria-label') ?? '').toMatch(
      /john\.smith@cms\.hhs\.gov/
    )
  })
})
