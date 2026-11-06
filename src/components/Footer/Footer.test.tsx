import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Footer from './Footer'

// The repo's file transformer breaks on svg imports under jest.
jest.mock('../../assets/icons/logo.svg', () => 'logo.svg')

const renderFooter = (authenticated?: boolean) =>
  render(
    <MemoryRouter>
      <Footer authenticated={authenticated} />
    </MemoryRouter>
  )

test('links to the Help page for a signed-in user', () => {
  renderFooter(true)
  expect(screen.getByRole('link', { name: /help & support/i })).toHaveAttribute(
    'href',
    '/help'
  )
})

test('hides the Help link before sign-in', () => {
  renderFooter()
  expect(
    screen.queryByRole('link', { name: /help & support/i })
  ).not.toBeInTheDocument()
})
