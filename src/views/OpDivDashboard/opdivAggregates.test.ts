import {
  EXTREMES_PER_END,
  EXTREMES_THRESHOLD,
  buildOpDivRows,
  scopeSystemsToOpDiv,
  notStartedSystems,
  scoreBySystem,
  scoreSpread,
  splitExtremes,
  summarizeCompletion,
  summarizeOpDiv,
  summarizeRisk,
  summarizeTargetGap,
  systemsMissingIsso,
} from './opdivAggregates'
import { makeProgress, makeSystem } from './testFixtures'
import type { DashboardMaps } from '@/views/Home/aggregateScores'

const emptyMaps = (): DashboardMaps => ({
  scoreMap: {},
  progressMap: {},
  systemCallMap: {},
  chosenCallMap: {},
})

describe('scopeSystemsToOpDiv', () => {
  it('keeps only active systems in the given OpDiv', () => {
    const systems = [
      makeSystem({ fismasystemid: 1, opdiv_id: 7 }),
      makeSystem({ fismasystemid: 2, opdiv_id: 9 }),
      makeSystem({ fismasystemid: 3, opdiv_id: 7, decommissioned: true }),
      makeSystem({ fismasystemid: 4, opdiv_id: null }),
    ]
    expect(scopeSystemsToOpDiv(systems, 7).map((s) => s.fismasystemid)).toEqual(
      [1]
    )
  })
})

describe('summarizeOpDiv', () => {
  it('averages over scored systems only, not the whole OpDiv', () => {
    const systems = [
      makeSystem({ fismasystemid: 1 }),
      makeSystem({ fismasystemid: 2 }),
      makeSystem({ fismasystemid: 3 }),
    ]
    const maps = emptyMaps()
    maps.scoreMap = {
      1: { score: 4.0, tier: 'Advanced' },
      2: { score: 3.0, tier: 'Initial' },
      // System 3 was never enrolled: no score row at all.
    }
    const summary = summarizeOpDiv(buildOpDivRows(systems, maps))
    expect(summary.avgScore).toBeCloseTo(3.5)
    expect(summary.scoredCount).toBe(2)
    expect(summary.unscoredCount).toBe(1)
    expect(summary.systemCount).toBe(3)
  })

  it('reports a null average rather than 0 when nothing is scored', () => {
    // 0 would flow into a tier lookup and render a confident band over a page
    // that has no data at all.
    const summary = summarizeOpDiv(buildOpDivRows([makeSystem()], emptyMaps()))
    expect(summary.avgScore).toBeNull()
    expect(summary.highest).toBeNull()
    expect(summary.lowest).toBeNull()
  })

  it('counts a null hva as unknown, never as a non-HVA', () => {
    const systems = [
      makeSystem({ fismasystemid: 1, hva: true }),
      makeSystem({ fismasystemid: 2, hva: false }),
      makeSystem({ fismasystemid: 3, hva: null }),
      makeSystem({ fismasystemid: 4 }),
    ]
    const summary = summarizeOpDiv(buildOpDivRows(systems, emptyMaps()))
    expect(summary.hvaCount).toBe(1)
    expect(summary.hvaUnknownCount).toBe(2)
  })

  it('counts High FIPS on the backend title-case spelling', () => {
    const systems = [
      makeSystem({ fismasystemid: 1, fips: 'High' }),
      makeSystem({ fismasystemid: 2, fips: 'Moderate' }),
      makeSystem({ fismasystemid: 3, fips: null }),
    ]
    const summary = summarizeOpDiv(buildOpDivRows(systems, emptyMaps()))
    expect(summary.highFipsCount).toBe(1)
    expect(summary.fipsUnknownCount).toBe(1)
  })

  it('treats a zero score as unscored, since real scores floor at 1.0', () => {
    const maps = emptyMaps()
    maps.scoreMap = { 1: { score: 0, tier: 'Not Assessed' } }
    const summary = summarizeOpDiv(
      buildOpDivRows([makeSystem({ fismasystemid: 1 })], maps)
    )
    expect(summary.scoredCount).toBe(0)
    expect(summary.avgScore).toBeNull()
  })

  it('uses the API tier for the Optimal/Advanced count, not the number', () => {
    const maps = emptyMaps()
    // A score that would re-derive to Advanced, tiered Initial by the API.
    // The API wins: it alone knows the reduced-pillar scope behind the number.
    maps.scoreMap = { 1: { score: 3.5, tier: 'Initial' } }
    const summary = summarizeOpDiv(
      buildOpDivRows([makeSystem({ fismasystemid: 1 })], maps)
    )
    expect(summary.optimalAdvancedCount).toBe(0)
  })
})

describe('summarizeCompletion', () => {
  it('counts only systems the call expects questions from', () => {
    const systems = [
      makeSystem({ fismasystemid: 1 }),
      makeSystem({ fismasystemid: 2 }),
      makeSystem({ fismasystemid: 3 }),
    ]
    const maps = emptyMaps()
    maps.progressMap = {
      1: makeProgress(1, { questionsexpected: 10, questionsanswered: 10 }),
      2: makeProgress(2, { questionsexpected: 10, questionsanswered: 0 }),
      // System 3 is out of the call entirely.
      3: makeProgress(3, { questionsexpected: 0, questionsanswered: 0 }),
    }
    const completion = summarizeCompletion(buildOpDivRows(systems, maps))
    expect(completion.systemsInCall).toBe(2)
    expect(completion.systemsComplete).toBe(1)
    expect(completion.notStarted).toBe(1)
    expect(completion.progressPct).toBeCloseTo(50)
  })

  it('reports a null percentage when the call expects nothing', () => {
    const maps = emptyMaps()
    maps.progressMap = { 1: makeProgress(1, { questionsexpected: 0 }) }
    const completion = summarizeCompletion(
      buildOpDivRows([makeSystem({ fismasystemid: 1 })], maps)
    )
    expect(completion.progressPct).toBeNull()
  })

  it('takes the latest edit across the OpDiv', () => {
    const maps = emptyMaps()
    maps.progressMap = {
      1: makeProgress(1, { lastupdatedat: '2026-01-05T00:00:00Z' }),
      2: makeProgress(2, { lastupdatedat: '2026-03-09T00:00:00Z' }),
      3: makeProgress(3, { lastupdatedat: null }),
    }
    const systems = [1, 2, 3].map((id) => makeSystem({ fismasystemid: id }))
    expect(
      summarizeCompletion(buildOpDivRows(systems, maps)).lastUpdatedAt
    ).toBe('2026-03-09T00:00:00Z')
  })
})

describe('summarizeTargetGap', () => {
  it('counts a null target as no target asserted, not as a failure', () => {
    // The system detail card presents 'Advanced' as a display default. Baking
    // that in here would invent an asserted target for every unassessed system.
    const maps = emptyMaps()
    maps.scoreMap = { 1: { score: 2.2, tier: 'Initial' } }
    const gap = summarizeTargetGap(
      buildOpDivRows(
        [makeSystem({ fismasystemid: 1, target_maturity_tier: null })],
        maps
      )
    )
    expect(gap.noTarget).toBe(1)
    expect(gap.below).toBe(0)
    expect(gap.shortfalls).toHaveLength(0)
  })

  it('separates a target with no score from a genuine shortfall', () => {
    const systems = [
      makeSystem({ fismasystemid: 1, target_maturity_tier: 'Optimal' }),
      makeSystem({ fismasystemid: 2, target_maturity_tier: 'Advanced' }),
    ]
    const maps = emptyMaps()
    // System 1 has a target but was never scored; system 2 falls short.
    maps.scoreMap = { 2: { score: 2.2, tier: 'Initial' } }
    const gap = summarizeTargetGap(buildOpDivRows(systems, maps))
    expect(gap.unscored).toBe(1)
    expect(gap.below).toBe(1)
    expect(gap.shortfalls[0].gap).toBe(1)
  })

  it('orders shortfalls by widest gap first', () => {
    const systems = [
      makeSystem({
        fismasystemid: 1,
        fismaacronym: 'NARROW',
        target_maturity_tier: 'Advanced',
      }),
      makeSystem({
        fismasystemid: 2,
        fismaacronym: 'WIDE',
        target_maturity_tier: 'Optimal',
      }),
    ]
    const maps = emptyMaps()
    maps.scoreMap = {
      1: { score: 2.2, tier: 'Initial' },
      2: { score: 1.5, tier: 'Traditional' },
    }
    const gap = summarizeTargetGap(buildOpDivRows(systems, maps))
    expect(gap.shortfalls.map((s) => s.system.fismaacronym)).toEqual([
      'WIDE',
      'NARROW',
    ])
  })
})

describe('scoreBySystem', () => {
  it('omits unscored systems rather than plotting them at zero', () => {
    const systems = [
      makeSystem({ fismasystemid: 1, fismaacronym: 'A' }),
      makeSystem({ fismasystemid: 2, fismaacronym: 'B' }),
    ]
    const maps = emptyMaps()
    maps.scoreMap = { 1: { score: 3.2, tier: 'Advanced' } }
    const bars = scoreBySystem(buildOpDivRows(systems, maps))
    expect(bars.map((b) => b.acronym)).toEqual(['A'])
  })

  it('sorts highest first', () => {
    const systems = [1, 2, 3].map((id) =>
      makeSystem({ fismasystemid: id, fismaacronym: `S${id}` })
    )
    const maps = emptyMaps()
    maps.scoreMap = {
      1: { score: 2.0, tier: 'Initial' },
      2: { score: 4.5, tier: 'Optimal' },
      3: { score: 3.1, tier: 'Advanced' },
    }
    expect(
      scoreBySystem(buildOpDivRows(systems, maps)).map((b) => b.acronym)
    ).toEqual(['S2', 'S3', 'S1'])
  })
})

describe('splitExtremes', () => {
  const bars = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      fismasystemid: i + 1,
      acronym: `S${i + 1}`,
      // Descending, as scoreBySystem returns them.
      score: 5 - i * 0.1,
      tier: 'Advanced' as const,
    }))

  it('hides nothing when the whole list already fits', () => {
    const result = splitExtremes(bars(EXTREMES_THRESHOLD))
    expect(result.top).toHaveLength(EXTREMES_THRESHOLD)
    expect(result.bottom).toEqual([])
    expect(result.hiddenCount).toBe(0)
  })

  it('keeps both ends and reports the omitted middle', () => {
    // The card grew without bound before this: an OpDiv with hundreds of
    // systems stretched its grid row into mostly empty space, and the bars
    // were unreadable at that density anyway.
    const result = splitExtremes(bars(300))
    expect(result.top).toHaveLength(EXTREMES_PER_END)
    expect(result.bottom).toHaveLength(EXTREMES_PER_END)
    expect(result.top[0].acronym).toBe('S1')
    expect(result.bottom[EXTREMES_PER_END - 1].acronym).toBe('S300')
    expect(result.hiddenCount).toBe(300 - EXTREMES_PER_END * 2)
  })

  it('accounts for every system it was given', () => {
    const result = splitExtremes(bars(37))
    expect(result.top.length + result.bottom.length + result.hiddenCount).toBe(
      37
    )
  })

  it('never overlaps the two ends at the threshold boundary', () => {
    // One past the threshold is the tightest case: the two ends must not
    // reach across each other and double-count a system.
    const result = splitExtremes(bars(EXTREMES_THRESHOLD + 1))
    const ids = [...result.top, ...result.bottom].map((b) => b.fismasystemid)
    expect(new Set(ids).size).toBe(ids.length)
    expect(result.hiddenCount).toBe(
      EXTREMES_THRESHOLD + 1 - EXTREMES_PER_END * 2
    )
  })

  it('summarizes the spread, where a floor-heavy tail splits mean from median', () => {
    const spread = scoreSpread([
      { fismasystemid: 1, acronym: 'A', score: 1, tier: 'Not Assessed' },
      { fismasystemid: 2, acronym: 'B', score: 1, tier: 'Not Assessed' },
      { fismasystemid: 3, acronym: 'C', score: 4.8, tier: 'Optimal' },
    ])
    expect(spread).toEqual({ min: 1, median: 1, max: 4.8 })
  })

  it('averages the two middle values for an even count', () => {
    const spread = scoreSpread([
      { fismasystemid: 1, acronym: 'A', score: 2, tier: 'Initial' },
      { fismasystemid: 2, acronym: 'B', score: 3, tier: 'Advanced' },
    ])
    expect(spread?.median).toBeCloseTo(2.5)
  })

  it('has no spread when nothing is scored', () => {
    expect(scoreSpread([])).toBeNull()
  })

  it('handles an empty list', () => {
    expect(splitExtremes([])).toEqual({ top: [], bottom: [], hiddenCount: 0 })
  })
})

describe('carried-forward answers on an open call', () => {
  // The regression: a new cycle is seeded with the previous cycle's answers,
  // so a system nobody has touched reports questionsanswered === expected
  // while the systems table shows it as "0/40 Awaiting confirmation". Judging
  // on answers counted every such system as complete, so the dashboard
  // reported "every system has been started" directly above a table of
  // untouched ones.
  const OPEN_CALL = 104

  const carriedForwardRows = () => {
    const systems = [
      makeSystem({ fismasystemid: 1, fismaacronym: 'CARRIED' }),
      makeSystem({ fismasystemid: 2, fismaacronym: 'FRESH' }),
      makeSystem({ fismasystemid: 3, fismaacronym: 'WORKING' }),
    ]
    const maps = emptyMaps()
    maps.chosenCallMap = { 1: OPEN_CALL, 2: OPEN_CALL, 3: OPEN_CALL }
    maps.progressMap = {
      // Every answer carried over, nothing confirmed this cycle.
      1: makeProgress(1, {
        questionsexpected: 40,
        questionsanswered: 40,
        questionsupdated: 0,
      }),
      // Nothing at all.
      2: makeProgress(2, {
        questionsexpected: 40,
        questionsanswered: 0,
        questionsupdated: 0,
      }),
      // Genuinely underway.
      3: makeProgress(3, {
        questionsexpected: 40,
        questionsanswered: 40,
        questionsupdated: 12,
      }),
    }
    return buildOpDivRows(systems, maps)
  }

  it('counts an unconfirmed carried-forward system as having no progress', () => {
    const result = notStartedSystems(carriedForwardRows(), OPEN_CALL, false)
    expect(result.map((r) => r.row.system.fismaacronym)).toEqual([
      'CARRIED',
      'FRESH',
    ])
    // Kept apart so the UI can say which kind of nothing it is.
    expect(
      result.find((r) => r.row.system.fismaacronym === 'CARRIED')
        ?.awaitingConfirmation
    ).toBe(true)
    expect(
      result.find((r) => r.row.system.fismaacronym === 'FRESH')
        ?.awaitingConfirmation
    ).toBe(false)
  })

  it('does not count it as complete', () => {
    const completion = summarizeCompletion(
      carriedForwardRows(),
      OPEN_CALL,
      false
    )
    expect(completion.systemsComplete).toBe(0)
    expect(completion.notStarted).toBe(2)
    expect(completion.awaitingConfirmation).toBe(1)
  })

  it('reports the percentage as confirmations, not answers', () => {
    const completion = summarizeCompletion(
      carriedForwardRows(),
      OPEN_CALL,
      false
    )
    // 12 of 120 confirmed. Answered would read 80/120 = 67% and contradict a
    // list of systems that are almost entirely untouched.
    expect(completion.measuresConfirmations).toBe(true)
    expect(completion.progressPct).toBeCloseTo(10)
  })

  it('judges a CLOSED call on answers, since nothing is updated once it ends', () => {
    // The opposite failure (ztmf#537): questionsupdated is 0 for everyone on a
    // closed call, so keying on it would report a finished historical cycle as
    // entirely not started.
    const completion = summarizeCompletion(
      carriedForwardRows(),
      OPEN_CALL,
      true
    )
    expect(completion.measuresConfirmations).toBe(false)
    expect(completion.systemsComplete).toBe(2)
    expect(completion.notStarted).toBe(1)
    expect(completion.progressPct).toBeCloseTo((80 / 120) * 100)
  })
})

describe('notStartedSystems', () => {
  it('names only enrolled systems with nothing answered', () => {
    const systems = [1, 2, 3, 4].map((id) =>
      makeSystem({ fismasystemid: id, fismaacronym: `S${id}` })
    )
    const maps = emptyMaps()
    maps.progressMap = {
      1: makeProgress(1, { questionsexpected: 10, questionsanswered: 0 }),
      2: makeProgress(2, { questionsexpected: 10, questionsanswered: 4 }),
      // Not in the call at all - not "not started".
      3: makeProgress(3, { questionsexpected: 0, questionsanswered: 0 }),
      // No progress row at all.
    }
    expect(
      notStartedSystems(buildOpDivRows(systems, maps)).map(
        (r) => r.row.system.fismaacronym
      )
    ).toEqual(['S1'])
  })

  it('orders by acronym so the worklist does not reshuffle', () => {
    const systems = ['ZED', 'ALPHA', 'MID'].map((acronym, i) =>
      makeSystem({ fismasystemid: i + 1, fismaacronym: acronym })
    )
    const maps = emptyMaps()
    maps.progressMap = {
      1: makeProgress(1, { questionsanswered: 0 }),
      2: makeProgress(2, { questionsanswered: 0 }),
      3: makeProgress(3, { questionsanswered: 0 }),
    }
    expect(
      notStartedSystems(buildOpDivRows(systems, maps)).map(
        (r) => r.row.system.fismaacronym
      )
    ).toEqual(['ALPHA', 'MID', 'ZED'])
  })
})

describe('systemsMissingIsso', () => {
  it('treats blank and whitespace-only emails as missing', () => {
    const systems = [
      makeSystem({ fismasystemid: 1, issoemail: 'a@example.gov' }),
      makeSystem({ fismasystemid: 2, issoemail: '' }),
      makeSystem({ fismasystemid: 3, issoemail: '   ' }),
      makeSystem({ fismasystemid: 4, issoemail: null }),
    ]
    expect(
      systemsMissingIsso(buildOpDivRows(systems, emptyMaps())).map(
        (s) => s.fismasystemid
      )
    ).toEqual([2, 3, 4])
  })
})

describe('summarizeRisk', () => {
  it('flags a system on either impact signal, and names why', () => {
    const systems = [
      makeSystem({ fismasystemid: 1, hva: true, fips: 'Moderate' }),
      makeSystem({ fismasystemid: 2, hva: false, fips: 'High' }),
      makeSystem({ fismasystemid: 3, hva: true, fips: 'High' }),
    ]
    const maps = emptyMaps()
    maps.scoreMap = {
      1: { score: 2.2, tier: 'Initial' },
      2: { score: 1.5, tier: 'Traditional' },
      3: { score: 4.2, tier: 'Optimal' },
    }
    const risk = summarizeRisk(buildOpDivRows(systems, maps))
    expect(risk.highImpact).toBe(3)
    expect(risk.atOrAboveFloor).toBe(1)
    expect(risk.belowFloor.map((r) => r.system.fismasystemid)).toEqual([2, 1])
    expect(risk.belowFloor[1].reasons).toEqual(['HVA'])
  })

  it('leaves a low-impact system off the list however weak it scores', () => {
    // The panel's whole claim is that impact is what makes a low score urgent.
    const systems = [makeSystem({ fismasystemid: 1, hva: false, fips: 'Low' })]
    const maps = emptyMaps()
    maps.scoreMap = { 1: { score: 1.0, tier: 'Not Assessed' } }
    const risk = summarizeRisk(buildOpDivRows(systems, maps))
    expect(risk.highImpact).toBe(0)
    expect(risk.belowFloor).toHaveLength(0)
    expect(risk.unknownImpact).toBe(0)
  })

  it('counts unrecorded impact apart rather than assuming low impact', () => {
    // A null flag is an unanswered question. Treating it as "not an HVA" would
    // quietly shrink the risk list by inventing a fact nobody entered.
    const systems = [makeSystem({ fismasystemid: 1, hva: null, fips: null })]
    const maps = emptyMaps()
    maps.scoreMap = { 1: { score: 1.4, tier: 'Traditional' } }
    const risk = summarizeRisk(buildOpDivRows(systems, maps))
    expect(risk.unknownImpact).toBe(1)
    expect(risk.highImpact).toBe(0)
  })

  it('counts one unrecorded flag as unknown when the other is not positive', () => {
    const systems = [
      makeSystem({ fismasystemid: 1, hva: null, fips: 'Low' }),
      makeSystem({ fismasystemid: 2, hva: false, fips: null }),
      makeSystem({ fismasystemid: 3, hva: null, fips: 'High' }),
      makeSystem({ fismasystemid: 4, hva: false, fips: 'Moderate' }),
    ]
    const risk = summarizeRisk(buildOpDivRows(systems, emptyMaps()))
    expect(risk.unknownImpact).toBe(2)
    expect(risk.highImpact).toBe(1)
  })

  it('separates a high-impact system with no score from one that is failing', () => {
    const systems = [
      makeSystem({ fismasystemid: 1, hva: true }),
      makeSystem({ fismasystemid: 2, hva: true }),
    ]
    const maps = emptyMaps()
    maps.scoreMap = { 2: { score: 2.0, tier: 'Initial' } }
    const risk = summarizeRisk(buildOpDivRows(systems, maps))
    expect(risk.unscored).toBe(1)
    expect(risk.belowFloor.map((r) => r.system.fismasystemid)).toEqual([2])
  })

  it('sorts an unassessed high-impact system above a scored weak one', () => {
    // Not Assessed is the bigger unknown, not the smaller problem.
    const systems = [
      makeSystem({ fismasystemid: 1, hva: true }),
      makeSystem({ fismasystemid: 2, hva: true }),
    ]
    const maps = emptyMaps()
    maps.scoreMap = {
      1: { score: 1.9, tier: 'Traditional' },
      2: { score: 1.0, tier: 'Not Assessed' },
    }
    const risk = summarizeRisk(buildOpDivRows(systems, maps))
    expect(risk.belowFloor.map((r) => r.system.fismasystemid)).toEqual([2, 1])
  })
})
