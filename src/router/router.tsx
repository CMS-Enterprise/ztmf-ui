/**
 * Component that renders all routes in the application.
 * @module router/router
 * @see {@link dashboard/main} for usage.
 */
import { createHashRouter, Navigate } from 'react-router-dom'
import authLoader from './authLoader'
import { RouteIds, Routes } from '@/router/constants'
import Title from '@/views/Title/Title'
import ErrorBoundary from '@/components/ErrorBoundary'
import HomePageContainer from '@/views/Home/Home'
import UserTable from '@/views/UserTable/UserTable'
import LoginPage from '@/views/LoginPage/LoginPage'
import QuestionnarePage from '@/views/QuestionnairePage/QuestionnairePage'
import SystemDetailPage from '@/views/SystemDetailPage/SystemDetailPage'
import PillarScoresPage from '@/views/PillarScoresPage/PillarScoresPage'
import OpDivAdmin from '@/views/OpDivAdmin/OpDivAdmin'
import OpDivDashboard from '@/views/OpDivDashboard/OpDivDashboard'
import OpDivIndexRedirect from '@/views/OpDivDashboard/OpDivIndexRedirect'
import EventsTable from '@/views/EventsTable/EventsTable'
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
        path: Routes.QUESTIONNAIRE_LEGACY,
        id: RouteIds.QUESTIONNAIRE_LEGACY,
        element: <QuestionnarePage />,
        errorElement: <ErrorBoundary />,
      },
      {
        path: Routes.SYSTEM_DETAIL,
        id: RouteIds.SYSTEM_DETAIL,
        element: <SystemDetailPage />,
        errorElement: <ErrorBoundary />,
      },
      {
        path: Routes.PILLAR_SCORES,
        id: RouteIds.PILLAR_SCORES,
        element: <PillarScoresPage />,
        errorElement: <ErrorBoundary />,
      },
      {
        path: Routes.OPDIVS,
        id: RouteIds.OPDIVS,
        element: <OpDivIndexRedirect />,
        errorElement: <ErrorBoundary />,
      },
      // Declared before the dynamic sibling to document the intent. React
      // Router ranks static segments above dynamic ones regardless of order,
      // and OpDivIndexRedirect rejects 'manage' defensively in case a future
      // reshuffle ever breaks that guarantee.
      {
        path: Routes.OPDIVS_MANAGE,
        id: RouteIds.OPDIVS_MANAGE,
        element: <OpDivAdmin />,
        errorElement: <ErrorBoundary />,
      },
      {
        path: Routes.OPDIV_DASHBOARD,
        id: RouteIds.OPDIV_DASHBOARD,
        element: <OpDivDashboard />,
        errorElement: <ErrorBoundary />,
      },
      // Legacy alias. The app is hash-routed, so bookmarks and pasted links
      // are the only consumers of the old path - there is no server rewrite
      // to update. Keep for at least one release.
      {
        path: Routes.ADMIN_OPDIVS,
        id: RouteIds.ADMIN_OPDIVS,
        element: <Navigate to={Routes.OPDIVS_MANAGE} replace />,
        errorElement: <ErrorBoundary />,
      },
      {
        path: Routes.ADMIN_EVENTS,
        id: RouteIds.ADMIN_EVENTS,
        element: <EventsTable />,
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
