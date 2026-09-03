/**
 * Central definitions for API endpoint paths and TanStack Query cache keys.
 *
 * `apiPaths` gives each backend endpoint one canonical spelling and owns
 * dynamic path/query construction so callers do not duplicate URL strings.
 * `queryKeys` mirrors those resources as hierarchical cache identifiers,
 * allowing related queries to be invalidated together after server writes.
 *
 * This module names requests and cached resources only. Axios remains the
 * transport, and callers still own request configuration and error handling.
 *
 * @module api/keys
 */
type ApiId = string | number
type QueryValue = string | number | boolean | null | undefined

/**
 * Appends encoded query values to an API path. Array values intentionally use
 * repeated parameters because the export endpoint expects `fsids=1&fsids=2`.
 */
function withQuery(
  path: string,
  values: Record<string, QueryValue | readonly ApiId[]>
): string {
  const query = new URLSearchParams()

  Object.entries(values).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, String(item)))
    } else if (value !== undefined && value !== null) {
      query.set(key, String(value))
    }
  })

  const encoded = query.toString()
  return encoded ? `${path}?${encoded}` : path
}

/**
 * Canonical API paths. Callers may continue using Axios directly, but endpoint
 * spelling and dynamic path construction live here instead of in each view.
 */
export const apiPaths = {
  auth: {
    lookup: '/auth/lookup',
    logout: '/auth/logout',
  },
  datacalls: {
    root: '/datacalls',
    latest: '/datacalls/latest',
    export: (datacallId: ApiId | undefined, systemIds: readonly ApiId[] = []) =>
      withQuery(`/datacalls/${datacallId}/export`, { fsids: systemIds }),
  },
  dataCenterEnvironments: '/datacenterenvironments',
  events: {
    root: '/events',
    view: '/events/view',
  },
  fismaSystems: {
    root: '/fismasystems',
    list: (decommissioned = false) =>
      withQuery('/fismasystems', {
        decommissioned: decommissioned || undefined,
      }),
    detail: (systemId: ApiId) => `/fismasystems/${systemId}`,
    questions: (systemId: ApiId, datacallId?: ApiId) =>
      withQuery(`/fismasystems/${systemId}/questions`, {
        datacallid: datacallId,
      }),
    delegates: (systemId: ApiId) => `/fismasystems/${systemId}/delegates`,
    delegate: (systemId: ApiId, userId: ApiId) =>
      `/fismasystems/${systemId}/delegates/${userId}`,
    delegateCandidates: (systemId: ApiId) =>
      `/fismasystems/${systemId}/delegate-candidates`,
    reactivate: (systemId: ApiId) => `/fismasystems/${systemId}/reactivate`,
    targetMaturity: (systemId: ApiId) =>
      `/fismasystems/${systemId}/target-maturity`,
  },
  functionOptions: (questionId: ApiId) => `/functions/${questionId}/options`,
  insights: '/insights',
  massEmails: '/massemails',
  opdivs: {
    root: '/opdivs',
    detail: (opdivId: ApiId) => `/opdivs/${opdivId}`,
    systemDelegateEnabled: (opdivId: ApiId) =>
      `/opdivs/${opdivId}/system-delegate-enabled`,
  },
  scores: {
    root: '/scores',
    detail: (scoreId: ApiId) => `/scores/${scoreId}`,
    confirm: (scoreId: ApiId) => `/scores/${scoreId}/confirm`,
    list: (
      datacallId: ApiId,
      systemId: ApiId | undefined,
      includeFunctionOption = false
    ) =>
      withQuery('/scores', {
        datacallid: datacallId,
        fismasystemid: systemId,
        include: includeFunctionOption ? 'functionoption' : undefined,
      }),
    aggregateByDatacall: (datacallId: ApiId) =>
      withQuery('/scores/aggregate', { datacallid: datacallId }),
    // `systemId` is temporarily optional while the current questionnaire
    // context is being migrated; retain its existing request shape until the
    // query layer gives that state an explicit enabled guard.
    aggregateBySystem: (systemId: ApiId | undefined) =>
      withQuery('/scores/aggregate', {
        fismasystemid: String(systemId),
        include_pillars: true,
      }),
    progress: (datacallId: ApiId) =>
      withQuery('/scores/progress', { datacallid: datacallId }),
    diff: (fromDatacallId: ApiId, toDatacallId: ApiId, systemId: ApiId) =>
      withQuery('/scores/diff', {
        from: fromDatacallId,
        to: toDatacallId,
        fismasystemid: systemId,
      }),
  },
  systemAttributes: '/systemattributes',
  systemEnrichment: (fismaUid: ApiId) => `/systemenrichment/${fismaUid}`,
  users: {
    root: '/users',
    current: '/users/current',
    detail: (userId: ApiId) => `/users/${userId}`,
    restore: (userId: ApiId) => `/users/${userId}/restore`,
    assignedOpdivs: (userId: ApiId) => `/users/${userId}/assignedopdivs`,
    opdivs: (userId: ApiId) => `/users/${userId}/opdivs`,
    assignedFismaSystems: (userId: ApiId) =>
      `/users/${userId}/assignedfismasystems`,
    assignedFismaSystem: (userId: ApiId, systemId: ApiId) =>
      `/users/${userId}/assignedfismasystems/${systemId}`,
    assignableFismaSystems: (userId: ApiId) =>
      `/users/${userId}/assignablefismasystems`,
  },
} as const

/**
 * Hierarchical TanStack Query keys. Parameters that affect a response remain
 * structured values so broad prefixes can invalidate related cached reads.
 */
export const queryKeys = {
  datacalls: {
    all: ['datacalls'] as const,
    list: () => ['datacalls', 'list'] as const,
  },
  dataCenterEnvironments: {
    all: ['data-center-environments'] as const,
    list: () => ['data-center-environments', 'list'] as const,
  },
  events: {
    all: ['events'] as const,
    list: (params: Record<string, QueryValue>) =>
      ['events', 'list', params] as const,
  },
  fismaSystems: {
    all: ['fisma-systems'] as const,
    lists: () => ['fisma-systems', 'list'] as const,
    list: (decommissioned = false) =>
      ['fisma-systems', 'list', { decommissioned }] as const,
    details: () => ['fisma-systems', 'detail'] as const,
    detail: (systemId: ApiId) => ['fisma-systems', 'detail', systemId] as const,
    questions: (systemId: ApiId, datacallId?: ApiId) =>
      [
        'fisma-systems',
        'detail',
        systemId,
        'questions',
        { datacallId },
      ] as const,
    delegates: (systemId: ApiId) =>
      ['fisma-systems', 'detail', systemId, 'delegates'] as const,
    delegateCandidates: (systemId: ApiId, search = '') =>
      [
        'fisma-systems',
        'detail',
        systemId,
        'delegate-candidates',
        { search },
      ] as const,
  },
  functionOptions: (questionId: ApiId) =>
    ['functions', questionId, 'options'] as const,
  insights: (systemId: ApiId) => ['insights', { systemId }] as const,
  opdivs: {
    all: ['opdivs'] as const,
    list: (includeInactive = false) =>
      ['opdivs', 'list', { includeInactive }] as const,
  },
  scores: {
    all: ['scores'] as const,
    list: (datacallId: ApiId, systemId: ApiId, includeFunctionOption = false) =>
      [
        'scores',
        'list',
        { datacallId, systemId, includeFunctionOption },
      ] as const,
    aggregateByDatacall: (datacallId: ApiId) =>
      ['scores', 'aggregate', { datacallId }] as const,
    aggregateBySystem: (systemId: ApiId) =>
      ['scores', 'aggregate', { systemId, includePillars: true }] as const,
    progress: (datacallId: ApiId) =>
      ['scores', 'progress', { datacallId }] as const,
    diff: (fromDatacallId: ApiId, toDatacallId: ApiId, systemId: ApiId) =>
      ['scores', 'diff', { fromDatacallId, toDatacallId, systemId }] as const,
  },
  systemAttributes: (selectableOnly = true) =>
    ['system-attributes', { selectableOnly }] as const,
  systemEnrichment: (fismaUid: ApiId) =>
    ['system-enrichment', fismaUid] as const,
  users: {
    all: ['users'] as const,
    list: (deleted = false) => ['users', 'list', { deleted }] as const,
    detail: (userId: ApiId) => ['users', 'detail', userId] as const,
    assignedOpdivs: (userId: ApiId) =>
      ['users', 'detail', userId, 'assigned-opdivs'] as const,
    assignedFismaSystems: (userId: ApiId) =>
      ['users', 'detail', userId, 'assigned-fisma-systems'] as const,
    assignableFismaSystems: (userId: ApiId) =>
      ['users', 'detail', userId, 'assignable-fisma-systems'] as const,
  },
} as const
