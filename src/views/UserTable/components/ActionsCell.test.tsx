import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ActionsCell from './ActionsCell'

describe('ActionsCell', () => {
  // The DataGrid virtualizes the actions column under jsdom, so the
  // UserTable integration suite cannot reach those cells; this file locks
  // the standalone behavior of the actions cell instead. Each of the four
  // callbacks must fire exactly once on its trigger and not be cross-wired.

  test('Edit / Delete / More buttons render with tooltipped labels', () => {
    render(
      <ActionsCell
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onAssignSystems={jest.fn()}
        onAssignOpDivs={jest.fn()}
      />
    )
    expect(screen.getByLabelText('Edit user')).toBeInTheDocument()
    expect(screen.getByLabelText('Delete user')).toBeInTheDocument()
    expect(screen.getByLabelText('More actions')).toBeInTheDocument()
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
    await userEvent.click(screen.getByLabelText('Edit user'))
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
    await userEvent.click(screen.getByLabelText('Delete user'))
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
