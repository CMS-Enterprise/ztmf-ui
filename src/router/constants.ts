export enum RouteIds {
  ROOT = 'root',
  PROTECTED = 'app',
  DASHBOARD = 'dashboard',
  QUESTIONNAIRE = 'questionnaire',
  AUTH = 'auth',
  LOGIN = 'login',
  LOGOUT = 'logout',
  HOME = 'home',
  DATA = 'data',
  USERS = 'users',
  SIGNIN = 'signin',
  SYSTEM_DETAIL = 'system-detail',
}

export enum RouteNames {
  DASHBOARD = 'Dashboard',
  QUESTIONNAIRE = 'questionnaire',
  LOGIN = 'Login',
  LOGOUT = 'Logout',
  SIGNIN = 'Sign In',
}

export enum Routes {
  ROOT = '/',
  DASHBOARD = `/${RouteIds.PROTECTED}`,
  HOME = `/${RouteIds.HOME}`,
  USERS = `/${RouteIds.USERS}`,
  QUESTIONNAIRE = `/${RouteIds.QUESTIONNAIRE}/:fismaacronym/:datacallid?/:pillar?/:function?`,
  AUTH = `/${RouteIds.AUTH}/*`,
  AUTH_LOGIN = `/${RouteIds.AUTH}/${RouteIds.LOGIN}`,
  AUTH_LOGOUT = `/${RouteIds.AUTH}/${RouteIds.LOGOUT}`,
  SIGNIN = `/${RouteIds.SIGNIN}`,
  SYSTEM_DETAIL = '/systems/:fismasystemid',
}
