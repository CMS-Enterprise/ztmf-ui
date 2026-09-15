import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import SystemDetailHeader from './SystemDetailHeader'

// Cross-navigation coverage for ui#609: System Info needs a link to the
// system's questionnaire. Both routes are keyed on :fismasystemid (#732), so
// the link is a plain anchor with no route state: acronyms are not unique and
// change on rename, and the id form opens this exact system from any click
// shape, including open-in-new-tab and a pasted copy of the link.

const BASE_PROPS = {
  systemName: 'Super Star Destroyer Executor Command Systems',
  fismasystemid: 1002,
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
        path: '/questionnaire/:fismasystemid',
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

it('targets the questionnaire keyed on the fismasystemid', () => {
  renderHeader()
  // Same URL shape the dashboard's questionnaire action builds (FismaTable
  // openQuestionnaire), so both entry points share one link. Bare id with no
  // trailing segments: the omitted datacall is what makes QuestionnairePage
  // resolve the cycle itself, and pinning one from here would fix the wrong
  // call.
  expect(
    screen.getByRole('link', { name: 'Questionnaire' }).getAttribute('href')
  ).toBe('/questionnaire/1002')
})

it('never puts the acronym in the link, so a rename or a slash cannot break it', () => {
  renderHeader({ systemName: 'Alliance/Fleet Comms' })
  expect(
    screen.getByRole('link', { name: 'Questionnaire' }).getAttribute('href')
  ).toBe('/questionnaire/1002')
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
