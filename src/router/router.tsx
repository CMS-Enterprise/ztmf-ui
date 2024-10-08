/**
 * Component that renders all routes in the application.
 * @module router/router
 * @see {@link dashboard/main} for usage.
 */
import { createHashRouter } from 'react-router-dom'
import ErrorBoundary from '@/components/ErrorBoundary'
import authLoader from './authLoader'
import { RouteIds, Routes } from '@/router/constants'
import HomePageContainer from '@/views/Home/Home'
import Title from '@/views/Title/Title'
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
    ],
  },
])

export default router
