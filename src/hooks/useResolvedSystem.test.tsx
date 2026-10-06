import { StrictMode, useState } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import type { FismaSystemType } from '@/types'

// axiosConfig reads import.meta.env at module load and throws under @swc/jest.
jest.mock('@/axiosConfig', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}))

// The hook reads the layout context. Serve it from a real React context so
// the harness below can hold the systems list in state, as Title does.
jest.mock('@/views/Title/Context', () => {
  const React = require('react')
  const MockCtx = React.createContext(null)
  return {
    __esModule: true,
    MockCtx,
    useContextProp: () => React.useContext(MockCtx),
  }
})

import axiosInstance from '@/axiosConfig'
import { useResolvedSystem } from './useResolvedSystem'

const { MockCtx } = jest.requireMock('@/views/Title/Context')
const get = axiosInstance.get as jest.Mock

const DEATH_STAR = {
  fismasystemid: 1001,
  fismaname: 'Death Star Orbital Battle Station',
} as FismaSystemType

let replaceList: (list: FismaSystemType[]) => void

function Probe({ id }: { id: number }) {
  const r = useResolvedSystem(id)
  return (
    <div data-testid="status">
      {r.status}
      {r.system ? `:${r.system.fismaname}` : ''}
    </div>
  )
}

function Harness({
  id,
  initial,
  loaded,
}: {
  id: number
  initial: FismaSystemType[]
  loaded: boolean
}) {
  const [list, setList] = useState(initial)
  replaceList = setList
  return (
    <MockCtx.Provider
      value={{
        fismaSystems: list,
        setFismaSystems: setList,
        fismaSystemsLoaded: loaded,
      }}
    >
      <Probe id={id} />
    </MockCtx.Provider>
  )
}

const status = () => screen.getByTestId('status').textContent
const notFound = () =>
  Promise.reject(Object.assign(new Error('404'), { response: { status: 404 } }))

beforeEach(() => {
  get.mockReset()
})

test('a system already in the list is found without a request', () => {
  render(<Harness id={1001} initial={[DEATH_STAR]} loaded />)
  expect(status()).toBe('found:Death Star Orbital Battle Station')
  expect(get).not.toHaveBeenCalled()
})

test('waits while the systems list is still loading', () => {
  render(<Harness id={1001} initial={[]} loaded={false} />)
  expect(status()).toBe('resolving')
  expect(get).not.toHaveBeenCalled()
})

test('a user with no accessible systems reaches not-found, not an endless spinner', async () => {
  // The list is loaded and empty. The lookup used to wait for a non-empty
  // list, so it never ran and the page spun forever.
  get.mockImplementation(notFound)
  render(<Harness id={1001} initial={[]} loaded />)
  await waitFor(() => expect(status()).toBe('not-found'))
  expect(get).toHaveBeenCalledWith('/fismasystems/1001', expect.anything())
})

test('a system missing from the list is fetched by id and added to it', async () => {
  get.mockResolvedValue({ data: { data: DEATH_STAR } })
  render(<Harness id={1001} initial={[]} loaded />)
  await waitFor(() =>
    expect(status()).toBe('found:Death Star Orbital Battle Station')
  )
  expect(get).toHaveBeenCalledTimes(1)
})

test('still resolves under StrictMode, which mounts effects twice in dev', async () => {
  // The first effect run is cancelled; the second must still settle.
  get.mockImplementation(notFound)
  render(
    <StrictMode>
      <Harness id={1001} initial={[]} loaded />
    </StrictMode>
  )
  await waitFor(() => expect(status()).toBe('not-found'))
})

test('a replaced list starts a fresh lookup instead of reusing an old miss', async () => {
  get.mockImplementation(notFound)
  render(<Harness id={1001} initial={[]} loaded />)
  await waitFor(() => expect(status()).toBe('not-found'))

  // A refetch (after a save, say) replaces the list; the system may be
  // fetchable now, so the old miss must not stand.
  get.mockResolvedValue({ data: { data: DEATH_STAR } })
  act(() => replaceList([]))
  expect(status()).toBe('resolving')
  await waitFor(() =>
    expect(status()).toBe('found:Death Star Orbital Battle Station')
  )
})

test('an invalid id is not-found without a request', () => {
  render(<Harness id={Number('abc')} initial={[]} loaded />)
  expect(status()).toBe('not-found')
  expect(get).not.toHaveBeenCalled()
})
