/**
 * Integration coverage for UserTable's mutating flows: user create/edit
 * (processRowUpdate), delete/restore with the self-delete guard, the OpDiv
 * grant-modal round trip (refreshUserRow), and the isCellEditable wiring the
 * grid actually receives. ActionsCell's own button semantics are pinned in
 * components/ActionsCell.test.tsx and isUserCellEditable's predicate in
 * cellEditGuards.test.ts; this file only proves UserTable wires them
 * correctly and drives the axios calls they trigger.
 *
 * MUI's DataGrid virtualizes columns under jsdom's zero-width layout, so the
 * far-right Actions/OpDivs-edit/identity-provider columns never mount in a
 * real render (see UserTable.test.tsx's note). This suite stubs DataGrid
 * with a minimal renderer - same convention as OpDivAdmin.test.tsx - that
 * runs every column's renderCell for every row and exposes the live
 * processRowUpdate/isCellEditable callbacks the component wires to the grid,
 * so the assertions exercise UserTable's real handlers rather than a
 * re-implementation of them.
 */
jest.mock('@/router/router', () => ({
  __esModule: true,
  default: { navigate: jest.fn() },
}))

jest.mock('@mui/x-data-grid', () => {
  const actual = jest.requireActual('@mui/x-data-grid')
  const react = require('react')
  return {
    ...actual,
    DataGrid: (props: {
      rows?: Array<Record<string, unknown>>
      columns?: Array<Record<string, unknown>>
      getRowId?: (row: Record<string, unknown>) => string | number
      apiRef?: { current: Record<string, unknown> | null }
      processRowUpdate?: (row: Record<string, unknown>) => unknown
      isCellEditable?: (p: {
        field: string
        row: Record<string, unknown>
      }) => boolean
    }) => {
      const { rows = [], columns = [], getRowId } = props
      mockGrid.rows = rows
      mockGrid.processRowUpdate = props.processRowUpdate
      mockGrid.isCellEditable = props.isCellEditable
      mockGrid.columns = columns
      if (props.apiRef) {
        props.apiRef.current = {
          getRow: (id: string | number) =>
            rows.find((r) => (getRowId ? getRowId(r) : r.id) === id),
          getRowWithUpdatedValues: (id: string | number) =>
            rows.find((r) => (getRowId ? getRowId(r) : r.id) === id),
          updateRows: () => {},
        }
      }
      return react.createElement(
        'div',
        { 'data-testid': 'datagrid-mock' },
        rows.map((row) => {
          const id = getRowId ? getRowId(row) : (row.id as string | number)
          return react.createElement(
            'div',
            { key: String(id), 'data-testid': `datagrid-row-${id}` },
            columns.map((col) => {
              const field = col.field as string
              const renderCell = col.renderCell as
                | ((p: {
                    row: Record<string, unknown>
                    id: string | number
                    value: unknown
                  }) => React.ReactNode)
                | undefined
              if (typeof renderCell !== 'function') return null
              return react.createElement(
                'div',
                { key: field, 'data-testid': `cell-${field}` },
                renderCell({ row, id, value: row[field] })
              )
            })
          )
        })
      )
    },
  }
})

/** Captures the live handlers the mocked grid receives on each render. */
const mockGrid: {
  rows?: Array<Record<string, unknown>>
  columns?: Array<Record<string, unknown>>
  processRowUpdate?: (row: Record<string, unknown>) => unknown
  isCellEditable?: (p: {
    field: string
    row: Record<string, unknown>
  }) => boolean
} = {}

jest.mock('@/axiosConfig', () => {
  const axios = require('axios').default
  return { __esModule: true, default: axios.create({ baseURL: '/api/v1/' }) }
})
jest.mock('@/utils/config', () => ({
  __esModule: true,
  default: { IDP_ENABLED: false },
}))
jest.mock('../Title/Context', () => ({
  useContextProp: () => ({
    userInfo: {
      userid: 'me',
      role: 'OWNER',
      email: 'me@x.gov',
      fullname: 'Me',
    },
    fismaSystems: [],
    setFismaSystems: jest.fn(),
    opdivs: [
      { opdiv_id: 1, code: 'CDC', name: 'CDC', is_parent: false, active: true },
      { opdiv_id: 2, code: 'NIH', name: 'NIH', is_parent: false, active: true },
    ],
    latestDataCallId: 1,
    latestDatacall: 'FY2025',
    latestDeadline: '',
    datacalls: [],
    selectedDatacall: null,
    setSelectedDatacall: jest.fn(),
    showDecommissioned: false,
    setShowDecommissioned: jest.fn(),
    fetchFismaSystems: jest.fn(),
    dashboardSearch: '',
    setDashboardSearch: jest.fn(),
  }),
}))

import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import axiosInstance from '@/axiosConfig'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import UserTable from './UserTable'

const mock = new MockAdapter(axiosInstance)

// A manageable user (within OWNER's assignable tier) other than the acting
// admin, so delete/edit/assign controls all render for it.
const PIETT_ROW = {
  userid: '22222222-2222-2222-2222-222222222222',
  email: 'piett@executor.empire',
  fullname: 'Admiral Piett',
  role: 'ISSO',
  assignedfismasystems: [],
  assignedopdivids: [],
  identity_provider: 'okta',
}

function mockUsers(list: Array<Record<string, unknown>>) {
  mock.onGet('/users').reply(200, { data: list })
}

function userDetailRequests(userid = PIETT_ROW.userid) {
  return mock.history.get.filter(
    (request) => request.url === `/users/${userid}`
  )
}

beforeEach(() => {
  mock.reset()
  mockUsers([PIETT_ROW])
  mock.onGet(/\/assignedopdivs$/).reply(200, { data: [] })
  mock.onGet(/\/fismasystems/).reply(200, { data: [] })
})

describe('processRowUpdate: create', () => {
  test('the Add user row is replaced by the server row after a successful save', async () => {
    let initialUsersRequested = false
    let resolveInitialUsers: (
      value: [number, { data: Array<Record<string, unknown>> }]
    ) => void = () => {}
    mock.onGet('/users').reply(() => {
      initialUsersRequested = true
      return new Promise((resolve) => {
        resolveInitialUsers = resolve
      })
    })
    let postBody: Record<string, unknown> | undefined
    mock.onPost('/users').reply((config) => {
      postBody = JSON.parse(config.data)
      return [201, { data: { userid: 'srv-1', identity_provider: null } }]
    })

    const user = userEvent.setup()
    renderWithProviders(<UserTable />)
    await waitFor(() => expect(initialUsersRequested).toBe(true))
    await act(async () => {
      resolveInitialUsers([200, { data: [] }])
      await Promise.resolve()
    })

    await user.click(screen.getByRole('button', { name: 'Add user' }))
    await waitFor(() => expect(mockGrid.rows).toHaveLength(1))
    const temporaryRow = mockGrid.rows?.[0]
    const temporaryId = temporaryRow?.userid
    expect(temporaryRow).toMatchObject({ isNew: true })
    expect(temporaryId).toEqual(expect.any(String))

    await act(async () => {
      await mockGrid.processRowUpdate?.({
        ...temporaryRow,
        fullname: 'New Admin',
        email: 'new@agency.gov',
        role: 'ISSO',
      })
    })

    expect(postBody).toMatchObject({
      fullname: 'New Admin',
      email: 'new@agency.gov',
      role: 'ISSO',
    })
    expect(mock.history.put).toHaveLength(0)
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    await waitFor(() => {
      expect(mockGrid.rows).toHaveLength(1)
      expect(
        mockGrid.rows?.filter((row) => row.userid === 'srv-1')
      ).toHaveLength(1)
      expect(mockGrid.rows?.some((row) => row.userid === temporaryId)).toBe(
        false
      )
    })
  })

  test('grants the selected OpDivs via PUT /users/:id/opdivs when a new row carries them', async () => {
    mockUsers([])
    mock
      .onPost('/users')
      .reply(201, { data: { userid: 'srv-9', identity_provider: null } })
    let putBody: Record<string, unknown> | undefined
    mock.onPut('/users/srv-9/opdivs').reply((config) => {
      putBody = JSON.parse(config.data)
      return [204]
    })
    mock.onGet('/users/srv-9').reply(200, {
      data: { identity_provider: 'entra', assignedopdivids: [1, 2] },
    })

    renderWithProviders(<UserTable />)
    await screen.findByTestId('datagrid-mock')

    await act(async () => {
      await mockGrid.processRowUpdate?.({
        userid: 600,
        isNew: true,
        fullname: 'Granted Admin',
        email: 'granted@agency.gov',
        role: 'OPDIV_ADMIN',
        opdivs: [1, 2],
      })
    })

    expect(putBody).toEqual({ opdiv_ids: [1, 2] })
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect(screen.queryByText(/OpDiv grants failed/i)).not.toBeInTheDocument()
  })

  test('a failed grant on an otherwise-successful create warns rather than silently dropping the grants', async () => {
    // Partial-failure path: the user is created, but the batch OpDiv grant
    // fails. The row must still show as created, with a warning telling the
    // admin to retry the grant from Assign OpDivs - not a plain error that
    // implies nothing happened.
    mockUsers([])
    mock
      .onPost('/users')
      .reply(201, { data: { userid: 'srv-42', identity_provider: null } })
    mock.onPut('/users/srv-42/opdivs').reply(500)

    renderWithProviders(<UserTable />)
    await screen.findByTestId('datagrid-mock')

    await act(async () => {
      await mockGrid.processRowUpdate?.({
        userid: 700,
        isNew: true,
        fullname: 'Partial Admin',
        email: 'partial@agency.gov',
        role: 'OPDIV_ADMIN',
        opdivs: [1],
      })
    })

    expect(
      await screen.findByText(
        /User created, but OpDiv grants failed\. Use Assign OpDivs to retry\./i
      )
    ).toBeInTheDocument()
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })

  test('surfaces a 400 field error on a failed create', async () => {
    mockUsers([])
    mock
      .onPost('/users')
      .reply(400, { data: { email: 'Email already exists' } })

    renderWithProviders(<UserTable />)
    await screen.findByTestId('datagrid-mock')

    await act(async () => {
      await mockGrid.processRowUpdate?.({
        userid: 501,
        isNew: true,
        fullname: 'Dup',
        email: 'dup@agency.gov',
        role: 'ISSO',
      })
    })

    expect(await screen.findByText(/Email already exists/i)).toBeInTheDocument()
  })
})

describe('processRowUpdate: edit', () => {
  test('PUTs only the profile fields for an existing row (no identity_provider)', async () => {
    let putUrl: string | undefined
    let putBody: Record<string, unknown> | undefined
    mock.onPut(`/users/${PIETT_ROW.userid}`).reply((config) => {
      putUrl = config.url
      putBody = JSON.parse(config.data)
      return [200]
    })

    renderWithProviders(<UserTable />)
    await screen.findByTestId('datagrid-mock')

    await act(async () => {
      await mockGrid.processRowUpdate?.({
        userid: PIETT_ROW.userid,
        isNew: false,
        fullname: 'Admiral Firmus Piett',
        email: 'piett@executor.empire',
        role: 'ISSM',
      })
    })

    expect(putUrl).toBe(`/users/${PIETT_ROW.userid}`)
    expect(putBody).toEqual({
      email: 'piett@executor.empire',
      fullname: 'Admiral Firmus Piett',
      role: 'ISSM',
    })
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  test('surfaces the error toast on a failed edit', async () => {
    mock
      .onPut(`/users/${PIETT_ROW.userid}`)
      .reply(400, { data: { email: 'Email already in use' } })

    renderWithProviders(<UserTable />)
    await screen.findByTestId('datagrid-mock')

    await act(async () => {
      await mockGrid.processRowUpdate?.({
        userid: PIETT_ROW.userid,
        isNew: false,
        fullname: 'Admiral Piett',
        email: 'dup@executor.empire',
        role: 'ISSO',
      })
    })

    expect(await screen.findByText(/Email already in use/i)).toBeInTheDocument()
  })

  test('a held profile save preserves newer grant and identity data when it resolves', async () => {
    let releaseProfileSave: () => void = () => {}
    mock.onPut(`/users/${PIETT_ROW.userid}`).reply(
      () =>
        new Promise((resolve) => {
          releaseProfileSave = () => resolve([200, {}])
        })
    )
    mock
      .onGet(`/users/${PIETT_ROW.userid}/assignedopdivs`)
      .reply(200, { data: [] })
    mock.onPut(`/users/${PIETT_ROW.userid}/opdivs`).reply(204)
    mock.onGet(`/users/${PIETT_ROW.userid}`).reply(200, {
      data: {
        ...PIETT_ROW,
        identity_provider: 'entra',
        assignedopdivids: [1],
      },
    })

    const user = userEvent.setup()
    renderWithProviders(<UserTable />)
    const row = await screen.findByTestId(`datagrid-row-${PIETT_ROW.userid}`)

    const profileSave = Promise.resolve(
      mockGrid.processRowUpdate?.({
        ...PIETT_ROW,
        fullname: 'Admiral Firmus Piett',
        role: 'ISSM',
        isNew: false,
      })
    )
    await waitFor(() =>
      expect(
        mock.history.put.filter(
          (request) => request.url === `/users/${PIETT_ROW.userid}`
        )
      ).toHaveLength(1)
    )

    await user.click(within(row).getByRole('button', { name: 'More actions' }))
    await user.click(
      await screen.findByRole('menuitem', { name: 'Assign OpDivs' })
    )
    await user.click(await screen.findByRole('checkbox', { name: /CDC/i }))
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(userDetailRequests()).toHaveLength(1))
    await waitFor(() =>
      expect(
        mockGrid.rows?.find(
          (candidate) => candidate.userid === PIETT_ROW.userid
        )
      ).toMatchObject({
        identity_provider: 'entra',
        assignedopdivids: [1],
      })
    )

    await act(async () => {
      releaseProfileSave()
      await profileSave
    })

    expect(
      mockGrid.rows?.find((candidate) => candidate.userid === PIETT_ROW.userid)
    ).toMatchObject({
      fullname: 'Admiral Firmus Piett',
      role: 'ISSM',
      identity_provider: 'entra',
      assignedopdivids: [1],
    })
  })
})

describe('delete / restore', () => {
  test('deleting confirms, DELETEs, drops the row, and notifies success', async () => {
    const user = userEvent.setup()
    mock.onDelete(`/users/${PIETT_ROW.userid}`).reply(200)

    renderWithProviders(<UserTable />)
    const row = await screen.findByTestId(`datagrid-row-${PIETT_ROW.userid}`)

    await user.click(within(row).getByRole('button', { name: 'Delete user' }))
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText(/Are you sure you want to delete Admiral Piett/)
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(mock.history.delete).toHaveLength(1))
    expect(mock.history.delete[0].url).toBe(`/users/${PIETT_ROW.userid}`)
    expect(
      await screen.findByText(/Delete User Admiral Piett/)
    ).toBeInTheDocument()
  })

  test('cancelling the delete confirmation issues no DELETE', async () => {
    const user = userEvent.setup()

    renderWithProviders(<UserTable />)
    const row = await screen.findByTestId(`datagrid-row-${PIETT_ROW.userid}`)

    await user.click(within(row).getByRole('button', { name: 'Delete user' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(mock.history.delete).toHaveLength(0)
  })

  test('the delete action is inert for the acting user (self-delete guard)', async () => {
    const user = userEvent.setup()
    mockUsers([
      {
        userid: 'me',
        email: 'me@x.gov',
        fullname: 'Me',
        role: 'OWNER',
        assignedfismasystems: [],
        assignedopdivids: [],
        identity_provider: 'okta',
      },
    ])

    renderWithProviders(<UserTable />)
    const row = await screen.findByTestId('datagrid-row-me')
    const deleteBtn = within(row).getByRole('button', { name: 'Delete user' })
    expect(deleteBtn).toHaveAttribute('aria-disabled', 'true')
    expect(deleteBtn).not.toBeDisabled()

    deleteBtn.focus()
    expect(deleteBtn).toHaveFocus()
    await user.click(deleteBtn)
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mock.history.delete).toHaveLength(0)
  })

  test('a failed DELETE surfaces the try-again error and keeps the row', async () => {
    const user = userEvent.setup()
    mock.onDelete(`/users/${PIETT_ROW.userid}`).reply(500)

    renderWithProviders(<UserTable />)
    const row = await screen.findByTestId(`datagrid-row-${PIETT_ROW.userid}`)

    await user.click(within(row).getByRole('button', { name: 'Delete user' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(mock.history.delete).toHaveLength(1))
    expect(await screen.findByText(/try again/i)).toBeInTheDocument()
    expect(
      screen.getByTestId(`datagrid-row-${PIETT_ROW.userid}`)
    ).toBeInTheDocument()
  })

  test('restoring confirms, PUTs /restore, and notifies success', async () => {
    const user = userEvent.setup()
    mockUsers([{ ...PIETT_ROW, deleted: true }])
    mock.onPut(`/users/${PIETT_ROW.userid}/restore`).reply(200)

    renderWithProviders(<UserTable />)
    const row = await screen.findByTestId(`datagrid-row-${PIETT_ROW.userid}`)

    await user.click(within(row).getByRole('button', { name: 'Restore user' }))
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText(/Restore Admiral Piett/)
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Restore' }))

    await waitFor(() => expect(mock.history.put).toHaveLength(1))
    expect(mock.history.put[0].url).toBe(`/users/${PIETT_ROW.userid}/restore`)
    expect(
      await screen.findByText(/Restore User Admiral Piett/)
    ).toBeInTheDocument()
  })
})

describe('OpDiv grant modal round trip', () => {
  test('saving the grant modal refreshes the row from the user detail endpoint', async () => {
    const user = userEvent.setup()
    mock
      .onGet(`/users/${PIETT_ROW.userid}/assignedopdivs`)
      .reply(200, { data: [] })
    mock.onPut(`/users/${PIETT_ROW.userid}/opdivs`).reply(204)
    mock.onGet(`/users/${PIETT_ROW.userid}`).reply(200, {
      data: {
        ...PIETT_ROW,
        identity_provider: 'entra',
        assignedopdivids: [1, 2],
      },
    })

    renderWithProviders(<UserTable />)
    const row = await screen.findByTestId(`datagrid-row-${PIETT_ROW.userid}`)

    await user.click(within(row).getByRole('button', { name: 'More actions' }))
    await user.click(
      await screen.findByRole('menuitem', { name: 'Assign OpDivs' })
    )
    const saveBtn = await screen.findByRole('button', { name: /^save$/i })
    await waitFor(() => expect(saveBtn).toBeEnabled())
    await user.click(saveBtn)

    await waitFor(() => expect(userDetailRequests()).toHaveLength(1))
  })

  test('a failed post-save row refresh warns rather than leaving the row silently stale', async () => {
    const user = userEvent.setup()
    const err = jest.spyOn(console, 'error').mockImplementation(() => {})
    mock
      .onGet(`/users/${PIETT_ROW.userid}/assignedopdivs`)
      .reply(200, { data: [] })
    mock.onPut(`/users/${PIETT_ROW.userid}/opdivs`).reply(204)
    mock.onGet(`/users/${PIETT_ROW.userid}`).networkError()

    renderWithProviders(<UserTable />)
    const row = await screen.findByTestId(`datagrid-row-${PIETT_ROW.userid}`)

    await user.click(within(row).getByRole('button', { name: 'More actions' }))
    await user.click(
      await screen.findByRole('menuitem', { name: 'Assign OpDivs' })
    )
    const saveBtn = await screen.findByRole('button', { name: /^save$/i })
    await waitFor(() => expect(saveBtn).toBeEnabled())
    await user.click(saveBtn)

    expect(
      await screen.findAllByText(
        /Could not refresh the latest data\. The information shown may be out of date\./i
      )
    ).toHaveLength(1)
    expect(userDetailRequests()).toHaveLength(1)
    err.mockRestore()
  })

  test('cancelling the grant modal does not request user detail', async () => {
    const user = userEvent.setup()
    mock
      .onGet(`/users/${PIETT_ROW.userid}/assignedopdivs`)
      .reply(200, { data: [] })

    renderWithProviders(<UserTable />)
    const row = await screen.findByTestId(`datagrid-row-${PIETT_ROW.userid}`)

    await user.click(within(row).getByRole('button', { name: 'More actions' }))
    await user.click(
      await screen.findByRole('menuitem', { name: 'Assign OpDivs' })
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled()
    )
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(userDetailRequests()).toHaveLength(0)
  })

  test('dismissing the grant modal does not request user detail', async () => {
    const user = userEvent.setup()
    mock
      .onGet(`/users/${PIETT_ROW.userid}/assignedopdivs`)
      .reply(200, { data: [] })

    renderWithProviders(<UserTable />)
    const row = await screen.findByTestId(`datagrid-row-${PIETT_ROW.userid}`)

    await user.click(within(row).getByRole('button', { name: 'More actions' }))
    await user.click(
      await screen.findByRole('menuitem', { name: 'Assign OpDivs' })
    )
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Close' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(userDetailRequests()).toHaveLength(0)
  })
})

describe('isCellEditable wiring', () => {
  test('forwards the field, row, and caller context (assignableRoles / showIdpSelector) to the guard', async () => {
    renderWithProviders(<UserTable />)
    await screen.findByTestId('datagrid-mock')

    const isCellEditable = mockGrid.isCellEditable!
    // role: editable when the caller (OWNER) can assign that role. This
    // throws if assignableRoles was not threaded through (undefined.includes),
    // so a true return here proves the context reached the guard.
    expect(
      isCellEditable({ field: 'role', row: { isNew: false, role: 'ISSO' } })
    ).toBe(true)
    // opdivs are only editable while creating a row, never on an existing one.
    expect(isCellEditable({ field: 'opdivs', row: { isNew: false } })).toBe(
      false
    )
    // A field with no special guard stays editable.
    expect(
      isCellEditable({
        field: 'fullname',
        row: { isNew: false, role: 'ISSO' },
      })
    ).toBe(true)
  })
})
