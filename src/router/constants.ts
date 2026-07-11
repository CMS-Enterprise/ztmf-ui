export enum RouteIds {
  ROOT = 'root',
  PROTECTED = 'app',
  DASHBOARD = 'dashboard',
  QUESTIONNAIRE = 'questionnaire',
  AUTH = 'auth',
  LOGIN = 'login',
  HOME = 'home',
  DATA = 'data',
  USERS = 'users',
  SIGNIN = 'signin',
  SYSTEM_DETAIL = 'system-detail',
  ADMIN_OPDIVS = 'admin-opdivs',
}

export enum RouteNames {
  DASHBOARD = 'Dashboard',
  QUESTIONNAIRE = 'questionnaire',
  LOGIN = 'Login',
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
  SIGNIN = `/${RouteIds.SIGNIN}`,
  SYSTEM_DETAIL = '/systems/:fismasystemid',
  ADMIN_OPDIVS = '/admin/opdivs',
}
