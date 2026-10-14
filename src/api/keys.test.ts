import { apiPaths, queryKeys } from './keys'

describe('scores.aggregate paths', () => {
  it('keeps the pre-factory URL contract for the datacall and system shapes', () => {
    expect(apiPaths.scores.aggregateByDatacall(7)).toBe(
      '/scores/aggregate?datacallid=7'
    )
    expect(apiPaths.scores.aggregateBySystem(3)).toBe(
      '/scores/aggregate?fismasystemid=3&include_pillars=true'
    )
  })

  it('omits include_pillars when false rather than sending it', () => {
    expect(apiPaths.scores.aggregate({ datacallId: 7 })).toBe(
      '/scores/aggregate?datacallid=7'
    )
    expect(
      apiPaths.scores.aggregate({ datacallId: 7, includePillars: false })
    ).toBe('/scores/aggregate?datacallid=7')
    expect(
      apiPaths.scores.aggregate({ datacallId: 7, includePillars: true })
    ).toBe('/scores/aggregate?datacallid=7&include_pillars=true')
  })

  it('drops datacallid entirely for the history request', () => {
    // An omitted datacallid is what makes the endpoint return every
    // (datacall, system) pair. A stray `datacallid=undefined` would silently
    // turn the full series into a 400.
    expect(apiPaths.scores.history()).toBe('/scores/aggregate')
    expect(apiPaths.scores.aggregate()).toBe('/scores/aggregate')
  })
})

describe('scores.aggregate query keys', () => {
  it('separates pillar-bearing from pillar-free responses for one datacall', () => {
    // The regression this guards: keyed together, whichever response landed
    // second would win and `pillarscores` would read undefined at random.
    expect(queryKeys.scores.aggregate({ datacallId: 7 })).not.toEqual(
      queryKeys.scores.aggregate({ datacallId: 7, includePillars: true })
    )
  })

  it('shares one entry across numeric and string spellings of an id', () => {
    expect(queryKeys.scores.aggregate({ datacallId: 7 })).toEqual(
      queryKeys.scores.aggregate({ datacallId: '7' })
    )
  })

  it('keeps the datacall and history keys distinct', () => {
    expect(queryKeys.scores.history()).not.toEqual(
      queryKeys.scores.aggregate({ datacallId: 7 })
    )
  })

  it('gives history the same key as the equivalent aggregate call', () => {
    // history() and aggregate({}) issue the identical request, so they must
    // not occupy two cache entries.
    expect(queryKeys.scores.history()).toEqual(queryKeys.scores.aggregate())
  })

  it('stays under the shared scores/aggregate prefix for invalidation', () => {
    expect(queryKeys.scores.aggregate({ datacallId: 7 }).slice(0, 2)).toEqual([
      'scores',
      'aggregate',
    ])
    expect(queryKeys.scores.aggregateBySystem(3).slice(0, 2)).toEqual([
      'scores',
      'aggregate',
    ])
  })
})
