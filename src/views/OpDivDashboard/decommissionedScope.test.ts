/**
 * Regression: the decommissioned toggle must not be able to zero the
 * dashboard.
 *
 * GET /fismasystems?decommissioned=true SWAPS the list rather than adding to
 * it, so with the toggle on the client holds decommissioned systems ONLY. The
 * dashboard scopes to active systems, so that combination leaves it with an
 * empty universe: hero, every KPI tile, every chart and the coverage panel all
 * read zero while the table underneath lists rows. And because the flag lives
 * in shared layout state, arriving from another page with it already on
 * reproduces it without touching a control here.
 */
import {
  buildOpDivRows,
  scopeSystemsToOpDiv,
  summarizeOpDiv,
} from './opdivAggregates'
import { makeSystem } from './testFixtures'
import type { DashboardMaps } from '@/views/Home/aggregateScores'

const OPDIV = 7

const maps: DashboardMaps = {
  scoreMap: { 1: { score: 3.4, tier: 'Advanced' } },
  progressMap: {},
  systemCallMap: {},
  chosenCallMap: {},
}

describe('decommissioned scope', () => {
  it('reports real figures from the default active-only list', () => {
    const active = [makeSystem({ fismasystemid: 1, opdiv_id: OPDIV })]
    const summary = summarizeOpDiv(
      buildOpDivRows(scopeSystemsToOpDiv(active, OPDIV), maps)
    )
    expect(summary.systemCount).toBe(1)
    expect(summary.avgScore).toBeCloseTo(3.4)
  })

  it('collapses to an empty universe when handed a decommissioned-only list', () => {
    // This is the state the toggle produces. The assertion documents WHY the
    // dashboard forces the flag off and withholds the control: there is no
    // honest active-posture figure to show while the list is swapped out, so
    // the fix is to prevent the state, not to render it.
    const swapped = [
      makeSystem({ fismasystemid: 1, opdiv_id: OPDIV, decommissioned: true }),
    ]
    const scoped = scopeSystemsToOpDiv(swapped, OPDIV)
    expect(scoped).toEqual([])

    const summary = summarizeOpDiv(buildOpDivRows(scoped, maps))
    expect(summary.systemCount).toBe(0)
    expect(summary.avgScore).toBeNull()
  })
})
