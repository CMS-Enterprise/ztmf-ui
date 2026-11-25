import { fireEvent, render, screen } from '@testing-library/react'
import CarryForwardStrip from './CarryForwardStrip'

const base = {
  state: 'unconfirmed' as const,
  showConfirm: true,
  confirming: false,
  onConfirm: jest.fn(),
  showHelper: true,
}

describe('CarryForwardStrip', () => {
  it('announces the state and ties the guidance to Confirm', () => {
    const onConfirm = jest.fn()
    render(<CarryForwardStrip {...base} onConfirm={onConfirm} />)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Carried forward - not yet confirmed'
    )
    const confirm = screen.getByRole('button', {
      name: 'Confirm this answer is still accurate',
    })
    expect(confirm).toHaveAccessibleDescription(
      /Review the carried-forward answer/
    )
    fireEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalled()
  })

  it('renders the undo slot beside the chip', () => {
    render(
      <CarryForwardStrip
        {...base}
        state="updated"
        showConfirm={false}
        showHelper={false}
        undo={<button type="button">Undo last change</button>}
      />
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'Updated this data call'
    )
    expect(
      screen.getByRole('button', { name: 'Undo last change' })
    ).toBeInTheDocument()
  })

  it('renders nothing for an answer that was not carried forward', () => {
    const { container } = render(
      <CarryForwardStrip
        {...base}
        state="none"
        showConfirm={false}
        showHelper={false}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
