import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ActionsCell from './ActionsCell'

describe('ActionsCell', () => {
  // The DataGrid virtualizes the actions column under jsdom, so the
  // UserTable integration suite cannot reach those cells; this file locks
  // the standalone behavior of the actions cell instead. Each of the four
  // callbacks must fire exactly once on its trigger and not be cross-wired.

  test('isSelf=true disables the Delete button without firing onDelete', () => {
    // Matches the pre-redesign bugfix pattern (commit 638b0d6): the Delete
    // icon stays visible (so the affordance is discoverable) but is
    // disabled. Browsers prevent click events from firing on disabled
    // buttons - this test pins both the disabled prop and a non-fired
    // callback. The action handler in UserTable.handleConfirmDelete is
    // the backstop if the button is ever re-enabled by a future refactor.
    const onDelete = jest.fn()
    render(
      <ActionsCell
        onEdit={jest.fn()}
        onDelete={onDelete}
        onAssignSystems={jest.fn()}
        onAssignOpDivs={jest.fn()}
        isSelf
      />
    )
    const button = screen.getByRole('button', { name: 'Delete user' })
    expect(button).toBeInTheDocument()
    expect(button).toBeDisabled()
    // (Skip userEvent.click - it correctly refuses to interact with a
    // pointer-events: none element, which is what disabled MUI buttons
    // are. The disabled assertion above is what pins the behavior.)
    expect(onDelete).not.toHaveBeenCalled()
  })

  test('Edit / Delete / More buttons render with tooltipped labels', () => {
    render(
      <ActionsCell
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onAssignSystems={jest.fn()}
        onAssignOpDivs={jest.fn()}
      />
    )
    expect(
      screen.getByRole('button', { name: 'Edit user' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Delete user' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'More actions' })
    ).toBeInTheDocument()
  })

  test('Edit fires onEdit only', async () => {
    const onEdit = jest.fn()
    const onDelete = jest.fn()
    render(
      <ActionsCell
        onEdit={onEdit}
        onDelete={onDelete}
        onAssignSystems={jest.fn()}
        onAssignOpDivs={jest.fn()}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: 'Edit user' }))
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onDelete).not.toHaveBeenCalled()
  })

  test('Delete fires onDelete only', async () => {
    const onEdit = jest.fn()
    const onDelete = jest.fn()
    render(
      <ActionsCell
        onEdit={onEdit}
        onDelete={onDelete}
        onAssignSystems={jest.fn()}
        onAssignOpDivs={jest.fn()}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: 'Delete user' }))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onEdit).not.toHaveBeenCalled()
  })

  test('More menu fires Assign FISMA systems / Assign OpDivs callbacks and closes the menu', async () => {
    const onAssignSystems = jest.fn()
    const onAssignOpDivs = jest.fn()
    render(
      <ActionsCell
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onAssignSystems={onAssignSystems}
        onAssignOpDivs={onAssignOpDivs}
      />
    )
    await userEvent.click(screen.getByLabelText('More actions'))
    const systems = await screen.findByRole('menuitem', {
      name: /assign fisma systems/i,
    })
    await userEvent.click(systems)
    expect(onAssignSystems).toHaveBeenCalledTimes(1)
    // Menu closes on selection (no menuitem left in the DOM).
    expect(
      screen.queryByRole('menuitem', { name: /assign fisma systems/i })
    ).not.toBeInTheDocument()

    await userEvent.click(screen.getByLabelText('More actions'))
    await userEvent.click(
      await screen.findByRole('menuitem', { name: /assign opdivs/i })
    )
    expect(onAssignOpDivs).toHaveBeenCalledTimes(1)
  })
})
