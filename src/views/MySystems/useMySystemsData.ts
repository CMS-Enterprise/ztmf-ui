/**
 * Data for the system-scoped summary band.
 *
 * Thin by design: the figures come straight from the OpDiv dashboard's
 * orchestrator with no OpDiv filter, which for a system-scoped caller is
 * exactly their assigned systems - the backend narrows /scores/aggregate and
 * /scores/progress to AssignedFismaSystems before they reach the client.
 *
 * @module views/MySystems/useMySystemsData
 */
import { useMemo } from 'react'
import { useContextProp } from '@/views/Title/Context'
import {
  useOpDivDashboardData,
  type OpDivDashboardData,
} from '@/views/OpDivDashboard/useOpDivDashboardData'

/** Everything the band renders. */
export type MySystemsData = OpDivDashboardData

/**
 * Assembles the band's data for the caller's own systems.
 * @param {boolean} [includeHistory] - Whether to fetch the score history
 *   behind the trend; the band passes false while its detail is collapsed.
 * @returns {MySystemsData} The shared figures. Pillar aggregates are never
 *   fetched, since the band renders no pillar figures.
 */
export function useMySystemsData(includeHistory = true): MySystemsData {
  const { fismaSystems, opdivs } = useContextProp()

  // Trend cadence follows the caller's OpDiv when they have exactly one, since
  // CMS runs quarterly calls and everyone else the annual cycle. Systems spread
  // across OpDivs have no single cadence, so they fall back to the annual one -
  // the same reasoning the aggregate view uses.
  const trendCode = useMemo(() => {
    const ids = new Set(
      fismaSystems
        .filter((s) => !s.decommissioned)
        .map((s) => s.opdiv_id)
        .filter((id): id is number => id != null)
    )
    if (ids.size !== 1) return null
    const [only] = [...ids]
    return opdivs.find((od) => od.opdiv_id === only)?.code ?? null
  }, [fismaSystems, opdivs])

  return useOpDivDashboardData(null, {
    trendOpDivCode: trendCode,
    includePillars: false,
    includeHistory,
  })
}
