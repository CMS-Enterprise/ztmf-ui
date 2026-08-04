import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import SystemDetailHeader from './SystemDetailHeader'

// Cross-navigation coverage for ui#609: System Info needs a link to the
// system's questionnaire. The questionnaire route is keyed on :fismaacronym
// while this page is routed by :fismasystemid, so the acronym is passed in.

const BASE_PROPS = {
  systemName: 'Super Star Destroyer Executor Command Systems',
  fismaacronym: 'SSD-EX',
  canEdit: false,
  isEditing: false,
  isSaving: false,
  isFormValid: true,
  onEdit: jest.fn(),
  onSave: jest.fn(),
  onCancel: jest.fn(),
}

// Data-router harness so the component gets the same useNavigate the app does,
// and so the resulting pathname is assertable off router.state.
function renderHeader(props: Partial<typeof BASE_PROPS> = {}) {
  const router = createMemoryRouter(
    [
      {
        path: '/systems/:fismasystemid',
        element: <SystemDetailHeader {...BASE_PROPS} {...props} />,
      },
      {
        path: '/questionnaire/:fismaacronym',
        element: <div>questionnaire</div>,
      },
      { path: '/', element: <div>dashboard</div> },
    ],
    { initialEntries: ['/systems/1002'] }
  )
  render(<RouterProvider router={router} />)
  return router
}

it('renders Questionnaire as a link, not a bare button', () => {
  renderHeader()
  // An anchor (CmsButton href) rather than onClick + navigate, so
  // open-in-new-tab and copy-link work (#640 review).
  const link = screen.getByRole('link', { name: 'Questionnaire' })
  expect(link).toBeInTheDocument()
  expect(link.tagName).toBe('A')
})

it('targets the questionnaire keyed on the lowercased acronym', () => {
  renderHeader()
  // Lowercased to match the URL shape the dashboard's own questionnaire action
  // builds (FismaTable openQuestionnaire), so both entry points share one link.
  // Bare acronym with no trailing segments: the omitted datacall is what makes
  // QuestionnairePage resolve the cycle itself, and pinning one from here would
  // fix the wrong call.
  expect(
    screen.getByRole('link', { name: 'Questionnaire' }).getAttribute('href')
  ).toBe('/questionnaire/ssd-ex')
})

it('shows Questionnaire alongside Edit for an editor', () => {
  renderHeader({ canEdit: true })
  expect(
    screen.getByRole('link', { name: 'Questionnaire' })
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
})

it('hides Questionnaire while editing so a dirty form keeps Save/Cancel only', () => {
  renderHeader({ canEdit: true, isEditing: true })
  expect(
    screen.queryByRole('link', { name: 'Questionnaire' })
  ).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
})
