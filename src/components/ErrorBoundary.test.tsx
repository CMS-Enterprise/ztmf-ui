import { render, screen } from '@testing-library/react'
import { useRouteError } from 'react-router-dom'
import ErrorBoundary from '@/components/ErrorBoundary'

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(),
  useRouteError: jest.fn(),
  isRouteErrorResponse: jest.fn(),
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
  render(<ErrorBoundary />)
  expect(
    screen.getByText(/Something went wrong. Please try again./i)
  ).toBeInTheDocument()
})
