import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DevEnvironmentBanner from './DevEnvironmentBanner'
import { bannerVersion, setBannerDismissed } from './bannerDismissal'
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
  // setupTests does not clear storage between tests in a file.
  localStorage.clear()
})

// resetMocks clears a spy's implementation but leaves it installed over
// Storage.prototype, breaking localStorage for every test added after.
afterEach(() => {
  jest.restoreAllMocks()
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

test('uses the injected override message for authenticated users', () => {
  mockConfig.DEV_BANNER_MESSAGE = 'OpDiv data loaded for testing.'
  render(<DevEnvironmentBanner authenticated />)
  expect(screen.getByText('OpDiv data loaded for testing.')).toBeInTheDocument()
})

test('hides override copy, feedback, and contact from pre-login visitors', () => {
  mockConfig.DEV_BANNER_MESSAGE = 'OpDiv data loaded for testing.'
  mockConfig.DEV_FEEDBACK_URL = 'https://forms.example.gov/feedback'
  mockConfig.DEV_CONTACT_EMAIL = 'zerotrust@example.gov'
  render(<DevEnvironmentBanner />)
  // Generic marker shows, but nothing environment-specific leaks publicly.
  expect(screen.getByText(/non-production environment/i)).toBeInTheDocument()
  expect(
    screen.queryByText('OpDiv data loaded for testing.')
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('link', { name: /share testing feedback/i })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('link', { name: /contact us/i })
  ).not.toBeInTheDocument()
})

test('falls back to the default when the override is whitespace only', () => {
  mockConfig.DEV_BANNER_MESSAGE = '   '
  render(<DevEnvironmentBanner />)
  expect(screen.getByText(/non-production environment/i)).toBeInTheDocument()
})

test('renders feedback and contact links for authenticated users when configured', () => {
  mockConfig.DEV_FEEDBACK_URL = 'https://forms.example.gov/feedback'
  mockConfig.DEV_CONTACT_EMAIL = 'zerotrust@example.gov'
  render(<DevEnvironmentBanner authenticated />)
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
  render(<DevEnvironmentBanner authenticated />)
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

test('a signed-in dismissal survives a fresh page load', async () => {
  const user = userEvent.setup()
  // Override copy exercises the hashed stamp; the next test covers the sentinel.
  mockConfig.DEV_BANNER_MESSAGE = 'OpDiv data loaded for testing.'
  const { unmount } = render(<DevEnvironmentBanner authenticated />)
  await user.click(screen.getByRole('button', { name: /close/i }))
  unmount()

  // A remount stands in for a new tab or a reload - both start from scratch.
  render(<DevEnvironmentBanner authenticated />)
  expect(
    screen.queryByText('OpDiv data loaded for testing.')
  ).not.toBeInTheDocument()
})

test('a signed-in dismissal survives with the default copy too', async () => {
  const user = userEvent.setup()
  const { unmount } = render(<DevEnvironmentBanner authenticated />)
  await user.click(screen.getByRole('button', { name: /close/i }))
  unmount()

  render(<DevEnvironmentBanner authenticated />)
  expect(
    screen.queryByText(/non-production environment/i)
  ).not.toBeInTheDocument()
})

test('picks up a stored dismissal when the session starts mid-mount', () => {
  // Mounted signed-out, so the state initializer skips storage; only the effect
  // can hide the banner once the loader flips authenticated.
  setBannerDismissed(bannerVersion(''))
  const { rerender } = render(<DevEnvironmentBanner />)
  expect(screen.getByText(/non-production environment/i)).toBeInTheDocument()

  rerender(<DevEnvironmentBanner authenticated />)
  expect(
    screen.queryByText(/non-production environment/i)
  ).not.toBeInTheDocument()
})

test('does not record a dismissal for signed-out visitors', async () => {
  const user = userEvent.setup()
  render(<DevEnvironmentBanner />)
  await user.click(screen.getByRole('button', { name: /close/i }))
  expect(localStorage.length).toBe(0)
})

test('does not persist a dismissal made before sign-in', async () => {
  const user = userEvent.setup()
  const { unmount } = render(<DevEnvironmentBanner />)
  await user.click(screen.getByRole('button', { name: /close/i }))
  unmount()

  render(<DevEnvironmentBanner />)
  expect(screen.getByText(/non-production environment/i)).toBeInTheDocument()
})

test('a pre-login dismissal does not suppress the banner after sign-in', async () => {
  const user = userEvent.setup()
  mockConfig.DEV_BANNER_MESSAGE = 'OpDiv data loaded for testing.'
  const { rerender } = render(<DevEnvironmentBanner />)
  await user.click(screen.getByRole('button', { name: /close/i }))

  rerender(<DevEnvironmentBanner authenticated />)
  expect(screen.getByText('OpDiv data loaded for testing.')).toBeInTheDocument()
})

test('shows again for a signed-in user when the banner copy changes', async () => {
  const user = userEvent.setup()
  mockConfig.DEV_BANNER_MESSAGE = 'Testing runs through July 17th.'
  const { unmount } = render(<DevEnvironmentBanner authenticated />)
  await user.click(screen.getByRole('button', { name: /close/i }))
  unmount()

  mockConfig.DEV_BANNER_MESSAGE = 'Testing is ongoing.'
  render(<DevEnvironmentBanner authenticated />)
  expect(screen.getByText('Testing is ongoing.')).toBeInTheDocument()
})

test('renders and dismisses when storage is unavailable', async () => {
  const user = userEvent.setup()
  // Private browsing and disabled site data make localStorage throw.
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('storage disabled')
  })
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('storage disabled')
  })

  render(<DevEnvironmentBanner authenticated />)
  expect(screen.getByText(/non-production environment/i)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /close/i }))
  expect(
    screen.queryByText(/non-production environment/i)
  ).not.toBeInTheDocument()
})
