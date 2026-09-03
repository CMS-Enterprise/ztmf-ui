import { apiPaths, queryKeys } from './keys'

describe('apiPaths', () => {
  it('normalizes dynamic paths with a leading slash', () => {
    expect(apiPaths.users.detail('user-1')).toBe('/users/user-1')
    expect(apiPaths.fismaSystems.questions(42)).toBe(
      '/fismasystems/42/questions'
    )
    expect(apiPaths.systemEnrichment('fisma-1')).toBe(
      '/systemenrichment/fisma-1'
    )
  })

  it('includes response-shaping query parameters in a stable order', () => {
    expect(apiPaths.scores.list(7, 42, true)).toBe(
      '/scores?datacallid=7&fismasystemid=42&include=functionoption'
    )
    expect(apiPaths.scores.diff(4, 7, 42)).toBe(
      '/scores/diff?from=4&to=7&fismasystemid=42'
    )
  })

  it('repeats selected system IDs for export', () => {
    expect(apiPaths.datacalls.export(7, [10, 20])).toBe(
      '/datacalls/7/export?fsids=10&fsids=20'
    )
  })
})

describe('queryKeys', () => {
  it('supports broad invalidation prefixes and parameterized detail keys', () => {
    expect(queryKeys.fismaSystems.detail(42)).toEqual([
      ...queryKeys.fismaSystems.details(),
      42,
    ])
    expect(queryKeys.fismaSystems.questions(42, 7)).toEqual([
      ...queryKeys.fismaSystems.detail(42),
      'questions',
      { datacallId: 7 },
    ])
    expect(queryKeys.users.list(true)).toEqual([
      ...queryKeys.users.all,
      'list',
      { deleted: true },
    ])
  })
})
