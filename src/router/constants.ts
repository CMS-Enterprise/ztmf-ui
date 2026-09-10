export enum RouteIds {
  ROOT = 'root',
  PROTECTED = 'app',
  DASHBOARD = 'dashboard',
  QUESTIONNAIRE = 'questionnaire',
  QUESTIONNAIRE_LEGACY = 'questionnaire-legacy',
  AUTH = 'auth',
  LOGIN = 'login',
  HOME = 'home',
  DATA = 'data',
  USERS = 'users',
  SIGNIN = 'signin',
  SYSTEM_DETAIL = 'system-detail',
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
  // Keyed on the system id, nested under the system like SYSTEM_DETAIL.
  // Acronyms are neither unique nor URL-safe (ztmf-misc#386, #382).
  QUESTIONNAIRE = `/systems/:fismasystemid/${RouteIds.QUESTIONNAIRE}/:datacallid?/:pillar?/:function?`,
  // Pre-#386 acronym-keyed shape. Kept so old bookmarks and shared links
  // redirect when the acronym resolves to exactly one system.
  QUESTIONNAIRE_LEGACY = `/${RouteIds.QUESTIONNAIRE}/:fismaacronym/:datacallid?/:pillar?/:function?`,
  AUTH = `/${RouteIds.AUTH}/*`,
  AUTH_LOGIN = `/${RouteIds.AUTH}/${RouteIds.LOGIN}`,
  SIGNIN = `/${RouteIds.SIGNIN}`,
  SYSTEM_DETAIL = '/systems/:fismasystemid',
  ADMIN_OPDIVS = '/admin/opdivs',
  ADMIN_EVENTS = '/admin/events',
}
