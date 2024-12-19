import { render, screen } from '@testing-library/react'
import {
  useNavigate,
  useRouteError,
  isRouteErrorResponse,
} from 'react-router-dom'
import ErrorBoundary from '@/components/ErrorBoundary'
import { Routes } from '@/router/constants'

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(),
  useRouteError: jest.fn(),
  isRouteErrorResponse: jest.fn(),
}))

// @ts-ignore
const isRouteErrorResponseMock = isRouteErrorResponse as jest.Mock
const useNavigateMock = useNavigate as jest.Mock
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
