import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

it('renders a Questionnaire button', () => {
  renderHeader()
  expect(
    screen.getByRole('button', { name: 'Questionnaire' })
  ).toBeInTheDocument()
})

it('navigates to the questionnaire keyed on the lowercased acronym', async () => {
  const router = renderHeader()
  await userEvent.click(screen.getByRole('button', { name: 'Questionnaire' }))
  // Lowercased to match the URL shape the dashboard's own questionnaire action
  // builds (FismaTable openQuestionnaire), so both entry points share one link.
  expect(router.state.location.pathname).toBe('/questionnaire/ssd-ex')
})

it('carries no route state, so the questionnaire falls back to the selected/latest call', async () => {
  const router = renderHeader()
  await userEvent.click(screen.getByRole('button', { name: 'Questionnaire' }))
  // Absent location.state.datacallid is what makes QuestionnairePage resolve
  // the cycle itself; sending a call id from here would pin the wrong one.
  expect(router.state.location.state).toBeNull()
})

it('still links a decommissioned system, leaving the explanation to the questionnaire', async () => {
  // The header takes no decommissioned flag on purpose: rather than hiding the
  // button, the questionnaire's own "no questionnaire is available" alert
  // explains the outcome (ui#609 review).
  const router = renderHeader()
  await userEvent.click(screen.getByRole('button', { name: 'Questionnaire' }))
  expect(router.state.location.pathname).toBe('/questionnaire/ssd-ex')
})

it('shows Questionnaire alongside Edit for an editor', () => {
  renderHeader({ canEdit: true })
  expect(
    screen.getByRole('button', { name: 'Questionnaire' })
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
})

it('hides Questionnaire while editing so a dirty form keeps Save/Cancel only', () => {
  renderHeader({ canEdit: true, isEditing: true })
  expect(
    screen.queryByRole('button', { name: 'Questionnaire' })
  ).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
})
