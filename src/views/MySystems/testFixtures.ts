/**
 * Fixture builders for the summary band's tests.
 * @module views/MySystems/testFixtures
 */

/**
 * A settled band with nothing in it, overridable per test.
 * @param {Record<string, unknown>} [overrides] - Top-level fields to replace.
 * @returns {Record<string, unknown>} What useMySystemsData would return.
 */
export function emptyBandData(overrides: Record<string, unknown> = {}) {
  return {
    isPending: false,
    isError: false,
    rows: [],
    summary: {
      systemCount: 0,
      scoredCount: 0,
      unscoredCount: 0,
      avgScore: null,
      hvaCount: 0,
      hvaUnknownCount: 0,
      highFipsCount: 0,
      fipsUnknownCount: 0,
      optimalAdvancedCount: 0,
      highest: null,
      lowest: null,
    },
    completion: {
      systemsInCall: 0,
      systemsComplete: 0,
      notStarted: 0,
      awaitingConfirmation: 0,
      questionsExpected: 0,
      questionsAnswered: 0,
      questionsUpdated: 0,
      progressPct: null,
      measuresConfirmations: false,
      lastUpdatedAt: null,
    },
    risk: { highImpact: 0, belowFloor: [], atOrAbove: 0, unscored: 0 },
    delta: {
      delta: null,
      n: 0,
      currentAvg: null,
      priorAvg: null,
      improved: 0,
      declined: 0,
    },
    daysRemaining: null,
    priorCall: null,
    trend: {
      points: [],
      isPending: false,
      isError: false,
      selectedCallId: null,
      selectCall: () => {},
      tiers: [],
      movers: { gained: [], lost: [], paired: 0, unchanged: 0 },
    },
    ...overrides,
  }
}

/**
 * Band data where the Not started, Answers to confirm and risk tiles all have
 * something to count.
 * @returns {Record<string, unknown>} What useMySystemsData would return.
 */
export function actionableBandData() {
  const base = emptyBandData()
  return emptyBandData({
    completion: {
      ...(base.completion as object),
      systemsInCall: 2,
      notStarted: 2,
      awaitingConfirmation: 1,
    },
    risk: { highImpact: 1, belowFloor: [{}], atOrAbove: 0, unscored: 0 },
  })
}
