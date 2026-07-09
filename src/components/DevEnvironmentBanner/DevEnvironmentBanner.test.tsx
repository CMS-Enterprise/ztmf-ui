import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DevEnvironmentBanner from './DevEnvironmentBanner'
import CONFIG from '@/utils/config'

// The component reads build-time config derived from import.meta.env, which
// throws under @swc/jest. Mock the resolved CONFIG object (created inside the
// hoisted factory to avoid a TDZ error) so tests can drive each
// environment/override combination by mutating the imported reference.
jest.mock('@/utils/config', () => ({
  __esModule: true,
  default: {
    IS_NONPROD: true,
    DEV_BANNER_MESSAGE: '',
    DEV_FEEDBACK_URL: '',
    DEV_CONTACT_EMAIL: '',
  },
}))

const mockConfig = CONFIG

beforeEach(() => {
  mockConfig.IS_NONPROD = true
  mockConfig.DEV_BANNER_MESSAGE = ''
  mockConfig.DEV_FEEDBACK_URL = ''
  mockConfig.DEV_CONTACT_EMAIL = ''
})

test('renders nothing in production', () => {
  mockConfig.IS_NONPROD = false
  const { container } = render(<DevEnvironmentBanner />)
  expect(container).toBeEmptyDOMElement()
})

test('shows the default notice in a non-production environment', () => {
  render(<DevEnvironmentBanner />)
  expect(screen.getByText(/non-production environment/i)).toBeInTheDocument()
})

test('uses the injected override message when provided', () => {
  mockConfig.DEV_BANNER_MESSAGE = 'OpDiv data loaded for testing.'
  render(<DevEnvironmentBanner />)
  expect(screen.getByText('OpDiv data loaded for testing.')).toBeInTheDocument()
})

test('falls back to the default when the override is whitespace only', () => {
  mockConfig.DEV_BANNER_MESSAGE = '   '
  render(<DevEnvironmentBanner />)
  expect(screen.getByText(/non-production environment/i)).toBeInTheDocument()
})

test('renders feedback and contact links only when configured', () => {
  mockConfig.DEV_FEEDBACK_URL = 'https://forms.example.gov/feedback'
  mockConfig.DEV_CONTACT_EMAIL = 'zerotrust@example.gov'
  render(<DevEnvironmentBanner />)
  expect(
    screen.getByRole('link', { name: /share testing feedback/i })
  ).toHaveAttribute('href', 'https://forms.example.gov/feedback')
  expect(screen.getByRole('link', { name: /contact us/i })).toHaveAttribute(
    'href',
    'mailto:zerotrust@example.gov'
  )
})

test('rejects a non-https feedback URL', () => {
  mockConfig.DEV_FEEDBACK_URL = 'javascript:alert(1)'
  render(<DevEnvironmentBanner />)
  expect(
    screen.queryByRole('link', { name: /share testing feedback/i })
  ).not.toBeInTheDocument()
})

test('can be dismissed', async () => {
  const user = userEvent.setup()
  render(<DevEnvironmentBanner />)
  expect(screen.getByText(/non-production environment/i)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /close/i }))
  expect(
    screen.queryByText(/non-production environment/i)
  ).not.toBeInTheDocument()
})
