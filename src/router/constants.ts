export enum RouteIds {
  ROOT = 'root',
  PROTECTED = 'app',
  DASHBOARD = 'dashboard',
  QUESTIONNAIRE = 'questionnaire',
  // Static segment that separates the id-keyed questionnaire path from a
  // legacy acronym one, so a digit-only acronym cannot be read as an id.
  QUESTIONNAIRE_SYSTEM = 'system',
  QUESTIONNAIRE_LEGACY = 'questionnaire-legacy',
  AUTH = 'auth',
  LOGIN = 'login',
  HOME = 'home',
  DATA = 'data',
  USERS = 'users',
  SIGNIN = 'signin',
  SYSTEM_DETAIL = 'system-detail',
  PILLAR_SCORES = 'pillar-scores',
  OPDIVS = 'opdivs',
  OPDIVS_MANAGE = 'opdivs-manage',
  OPDIV_DASHBOARD = 'opdiv-dashboard',
  // Retained only as the legacy redirect source. The management grid now
  // lives under the OpDivs tab at OPDIVS_MANAGE.
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
  QUESTIONNAIRE = `/${RouteIds.QUESTIONNAIRE}/${RouteIds.QUESTIONNAIRE_SYSTEM}/:fismasystemid/:datacallid?/:pillar?/:function?`,
  // Pre-#732 acronym links. Kept only so QuestionnairePage can redirect them
  // to the id form; nothing generates this shape any more.
  QUESTIONNAIRE_LEGACY = `/${RouteIds.QUESTIONNAIRE}/:fismaacronym/:datacallid?/:pillar?/:function?`,
  AUTH = `/${RouteIds.AUTH}/*`,
  AUTH_LOGIN = `/${RouteIds.AUTH}/${RouteIds.LOGIN}`,
  SIGNIN = `/${RouteIds.SIGNIN}`,
  SYSTEM_DETAIL = '/systems/:fismasystemid',
  PILLAR_SCORES = '/systems/:fismasystemid/pillar-scores',
  OPDIVS = `/${RouteIds.OPDIVS}`,
  OPDIVS_MANAGE = `/${RouteIds.OPDIVS}/manage`,
  OPDIV_DASHBOARD = `/${RouteIds.OPDIVS}/:opdivId`,
  ADMIN_OPDIVS = '/admin/opdivs',
  ADMIN_EVENTS = '/admin/events',
}

/**
 * Path to one OpDiv's dashboard, for links and redirects.
 * @param {number | string} opdivId - An OpDiv id, or 'all' for the aggregate.
 * @returns {string} The dashboard path.
 */
export const opdivDashboardPath = (opdivId: number | string): string =>
  `/${RouteIds.OPDIVS}/${opdivId}`
