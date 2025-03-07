/**
 * Component that renders all routes in the application.
 * @module router/router
 * @see {@link dashboard/main} for usage.
 */
import { createHashRouter } from 'react-router-dom'
import authLoader from './authLoader'
import { RouteIds, Routes } from '@/router/constants'
import Title from '@/views/Title/Title'
import ErrorBoundary from '@/components/ErrorBoundary'
import HomePageContainer from '@/views/Home/Home'
import UserTable from '@/views/UserTable/UserTable'
import LoginPage from '@/views/LoginPage/LoginPage'
import QuestionnarePage from '@/views/QuestionnairePage/QuestionnairePage'
/**
 * The hash router for the application that defines routes
 *  and specifies the loaders for routes with dynamic data.
 * @type {React.ComponentType} router - The browser router
 * @see {@link https://reactrouter.com/web/api/BrowserRouter BrowserRouter}
 * @see {@link https://reactrouter.com/en/main/route/loader loader}
 */
const router = createHashRouter([
  {
    id: RouteIds.ROOT,
    path: Routes.ROOT,
    element: <Title />,
    loader: authLoader,
    children: [
      {
        index: true,
        id: RouteIds.HOME,
        element: <HomePageContainer />,
        errorElement: <ErrorBoundary />,
      },
      {
        path: Routes.USERS,
        id: RouteIds.USERS,
        element: <UserTable />,
        errorElement: <ErrorBoundary />,
      },
      {
        path: Routes.QUESTIONNAIRE,
        id: RouteIds.QUESTIONNAIRE,
        element: <QuestionnarePage />,
        errorElement: <ErrorBoundary />,
      },
      {
        path: Routes.SIGNIN,
        id: RouteIds.SIGNIN,
        element: <LoginPage />,
        errorElement: <ErrorBoundary />,
      },
    ],
    errorElement: <ErrorBoundary />,
  },
])

export default router
