export enum RouteIds {
  ROOT = 'root',
  PROTECTED = 'app',
  DASHBOARD = 'dashboard',
  AUTH = 'auth',
  LOGIN = 'login',
  LOGOUT = 'logout',
  HOME = 'home',
  PILLARS = 'pillars',
  IDENTITY = 'identity',
  DEVICES = 'devices',
  NETWORKS = 'networks',
  APPLICATIONS = 'applications',
  DATA = 'data',
}

export enum RouteNames {
  DASHBOARD = 'Dashboard',
  LOGIN = 'Login',
  LOGOUT = 'Logout',
}

export enum Routes {
  ROOT = '/',
  DASHBOARD = `/${RouteIds.PROTECTED}`,
  HOME = `/${RouteIds.HOME}`,
  AUTH = `/${RouteIds.AUTH}/*`,
  AUTH_LOGIN = `/${RouteIds.AUTH}/${RouteIds.LOGIN}`,
  AUTH_LOGOUT = `/${RouteIds.AUTH}/${RouteIds.LOGOUT}`,
}
