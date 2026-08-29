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
  PILLAR_SCORES = 'pillar-scores',
  ADMIN_OPDIVS = 'admin-opdivs',
  ADMIN_EVENTS = 'admin-events',
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
  PILLAR_SCORES = '/systems/:fismasystemid/pillar-scores',
  ADMIN_OPDIVS = '/admin/opdivs',
  ADMIN_EVENTS = '/admin/events',
}
