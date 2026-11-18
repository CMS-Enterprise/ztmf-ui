import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import HelpPage from './HelpPage'
import CONFIG from '@/utils/config'

// CONFIG reads import.meta.env, which throws under @swc/jest.
jest.mock('@/utils/config', () => ({
  __esModule: true,
  default: { HELP_EMAIL: '' },
}))

let mockUser: Record<string, unknown>
jest.mock('@/views/Title/Context', () => ({
  useContextProp: () => ({ userInfo: mockUser }),
}))

jest.mock('./helpContent', () => {
  // Defined inside: jest hoists the factory above module-level helpers.
  const link = (title: string, url: string) => ({ title, description: '', url })
  return {
    ...jest.requireActual('./helpContent'),
    HELP_CONTENT: {
      cms: {
        topics: [
          {
            id: 'start',
            title: 'Getting started',
            blocks: [
              { kind: 'text', text: 'Use CMS Okta.' },
              { kind: 'heading', text: 'Sub heading' },
              {
                kind: 'list',
                items: [
                  'First step',
                  { icon: 'pillarScores', text: 'Pillar scores row' },
                ],
              },
            ],
            faq: [{ question: 'What is ZTMF?', answer: 'A framework.' }],
          },
          {
            id: 'scoring',
            title: 'Scoring',
            blocks: [
              {
                kind: 'table',
                head: ['Tier', 'Range'],
                rows: [['Optimal', '4.10+']],
              },
            ],
            faq: [],
          },
          {
            id: 'admin',
            title: 'For admins',
            adminOnly: true,
            blocks: [{ kind: 'text', text: 'For admins.' }],
            faq: [],
          },
        ],
        contactNote: 'CMS Slack note.',
        contactFallback: 'Ask your ISSO for help.',
        links: [
          link('Safe link', 'https://example.gov/a'),
          link('Unsafe link', 'http://example.gov/b'),
        ],
      },
      hhs: {
        topics: [
          {
            id: 'start',
            title: 'HHS start',
            blocks: [{ kind: 'text', text: 'Use Entra.' }],
            faq: [{ question: 'HHS question?', answer: 'HHS answer.' }],
          },
        ],
        contactNote: 'HHS note.',
        contactFallback: 'Contact your OpDiv Admin for help.',
        links: [],
      },
    },
  }
})

const mockConfig = CONFIG

const renderPage = (entry = '/help') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <HelpPage />
    </MemoryRouter>
  )

beforeEach(() => {
  mockConfig.HELP_EMAIL = ''
  mockUser = { identity_provider: 'okta', role: 'ISSO' }
})

test('opens on the first topic with its guide and questions', () => {
  renderPage()
  expect(
    screen.getByRole('heading', { level: 2, name: 'Getting started' })
  ).toBeInTheDocument()
  expect(screen.getByText('Use CMS Okta.')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Sub heading' })).toBeVisible()
  expect(screen.getByText('Pillar scores row')).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'What is ZTMF?' })
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Getting started' })
  ).toHaveAttribute('aria-current', 'page')
})

test('switches topics from the rail and moves focus to the new title', async () => {
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: 'Scoring' }))
  const title = screen.getByRole('heading', { level: 2, name: 'Scoring' })
  expect(screen.getByRole('cell', { name: '4.10+' })).toBeVisible()
  expect(screen.queryByText('Use CMS Okta.')).not.toBeInTheDocument()
  await new Promise((r) => requestAnimationFrame(r))
  expect(title).toHaveFocus()
})

test('opens the topic named in the URL', () => {
  renderPage('/help?topic=scoring')
  expect(
    screen.getByRole('heading', { level: 2, name: 'Scoring' })
  ).toBeInTheDocument()
})

test('expands a question', async () => {
  renderPage()
  const summary = screen.getByRole('button', { name: 'What is ZTMF?' })
  expect(summary).toHaveAttribute('aria-expanded', 'false')
  await userEvent.click(summary)
  expect(summary).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByText('A framework.')).toBeVisible()
})

test('lists only https resources, opening in a new tab', () => {
  renderPage()
  const link = screen.getByRole('link', { name: /safe link/i })
  expect(link).toHaveAttribute('href', 'https://example.gov/a')
  expect(link).toHaveAttribute('target', '_blank')
  expect(screen.queryByText('Unsafe link')).not.toBeInTheDocument()
})

test('links the email button to the configured address', () => {
  mockConfig.HELP_EMAIL = 'help@example.gov'
  renderPage()
  expect(
    screen.getByRole('link', { name: /email the zero trust team/i })
  ).toHaveAttribute(
    'href',
    expect.stringMatching(/^mailto:help@example\.gov\?/)
  )
  expect(screen.getByText('CMS Slack note.')).toBeInTheDocument()
})

test('falls back to contact guidance when no address is configured', () => {
  renderPage()
  expect(
    screen.queryByRole('link', { name: /email the zero trust team/i })
  ).not.toBeInTheDocument()
  expect(screen.getByText(/ask your isso for help/i)).toBeInTheDocument()
  // The fallback stands alone; the extra contact note rides with the button.
  expect(screen.queryByText('CMS Slack note.')).not.toBeInTheDocument()
})

test('shows HHS content to an Entra user', () => {
  mockConfig.HELP_EMAIL = 'help@example.gov'
  mockUser = { identity_provider: 'entra', role: 'ISSO' }
  renderPage()
  expect(
    screen.getByRole('heading', { level: 2, name: 'HHS start' })
  ).toBeInTheDocument()
  expect(screen.getByText('HHS note.')).toBeInTheDocument()
  expect(screen.queryByText('Getting started')).not.toBeInTheDocument()
  // An audience with no links drops the resources card entirely.
  expect(
    screen.queryByRole('heading', { name: 'More resources' })
  ).not.toBeInTheDocument()
})

test('shows CMS content when the identity provider is missing', () => {
  mockUser = { role: 'ISSO' }
  renderPage()
  expect(
    screen.getByRole('heading', { level: 2, name: 'Getting started' })
  ).toBeInTheDocument()
})

test('shows admin-only topics to admins only', () => {
  const { unmount } = renderPage()
  expect(
    screen.queryByRole('button', { name: 'For admins' })
  ).not.toBeInTheDocument()
  unmount()

  mockUser = { identity_provider: 'okta', role: 'OPDIV_ADMIN' }
  renderPage()
  expect(screen.getByRole('button', { name: 'For admins' })).toBeInTheDocument()
})

test('ignores an admin-only topic in the URL for a non-admin', () => {
  renderPage('/help?topic=admin')
  expect(
    screen.getByRole('heading', { level: 2, name: 'Getting started' })
  ).toBeInTheDocument()
})

test('exposes each question as a heading for screen readers', () => {
  renderPage()
  const heading = screen.getByRole('heading', {
    level: 4,
    name: 'What is ZTMF?',
  })
  // The heading wraps the toggle button, not the other way round.
  expect(heading.querySelector('[role="button"]')).not.toBeNull()
})
