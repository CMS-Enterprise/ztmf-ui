import { act } from 'react'
import { render, screen } from '@testing-library/react'
import { useRouteError } from 'react-router'
import ErrorBoundary from '@/components/ErrorBoundary'

jest.mock('react-router', () => ({
  useRouteError: jest.fn(),
}))

const routeErrorMock = useRouteError as jest.Mock

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.runOnlyPendingTimers()
  jest.useRealTimers()
  jest.clearAllMocks()
})

test('renders generic error message', () => {
  routeErrorMock.mockReturnValue(new Error('Something went wrong'))
  act(() => {
    render(<ErrorBoundary />)
  })
  expect(
    screen.getByText(/Something went wrong. Please try again./i)
  ).toBeInTheDocument()
})
