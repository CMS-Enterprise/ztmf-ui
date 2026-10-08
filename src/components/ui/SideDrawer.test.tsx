import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import SideDrawer from './SideDrawer'

// MUI's Drawer, unlike Dialog, puts no dialog semantics on its panel, so
// without these the drawer announces as nothing.
it('exposes the panel as a modal dialog named by its title', () => {
  renderWithProviders(
    <SideDrawer open onClose={jest.fn()} title="Answer history" id="panel">
      body
    </SideDrawer>
  )

  const dialog = screen.getByRole('dialog')
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(dialog).toHaveAttribute('id', 'panel')
  expect(dialog).toHaveAccessibleName('Answer history')
  expect(
    screen.getByRole('heading', { level: 2, name: 'Answer history' })
  ).toBeInTheDocument()
})

it('closes from the header control', () => {
  const onClose = jest.fn()
  renderWithProviders(
    <SideDrawer open onClose={onClose} title="Answer history">
      body
    </SideDrawer>
  )

  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(onClose).toHaveBeenCalled()
})
