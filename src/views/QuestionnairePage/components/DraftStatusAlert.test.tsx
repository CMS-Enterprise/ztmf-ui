import { render, screen } from '@testing-library/react'
import DraftStatusAlert from './DraftStatusAlert'

describe('DraftStatusAlert', () => {
  it.each([
    ['saved', /^Draft saved/],
    ['error', /^Draft could not be saved/],
    ['restored', /^Draft restored/],
  ] as const)('explains a %s draft', (status, text) => {
    render(<DraftStatusAlert status={status} />)
    expect(screen.getByRole('alert')).toHaveTextContent(text)
  })

  it('renders nothing while idle', () => {
    const { container } = render(<DraftStatusAlert status="idle" />)
    expect(container).toBeEmptyDOMElement()
  })
})
