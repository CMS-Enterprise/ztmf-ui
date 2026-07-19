import React from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  FismaSystemType,
  userData,
  datacall,
  DataCenterEnvironment,
} from '@/types'

type ContextType = {
  fismaSystems: FismaSystemType[] | []
  setFismaSystems: React.Dispatch<React.SetStateAction<FismaSystemType[]>>
  userInfo: userData
  latestDataCallId: number
  latestDatacall: string
  latestDeadline: string
  // All data calls (deadline-sorted) for resolving a call id to its name.
  datacalls: datacall[]
  // The data calls whose scores/progress the dashboard aggregates - the active
  // year's calls, toggleable. selectedDatacall is the single active call when
  // exactly one is on (drives the single-id flows), else null while aggregating.
  activeDatacallIds: number[]
  selectedDatacall: datacall | null
  // Single-select adapter over the year-grouped model: picking a call narrows
  // the active set to just that call; null resets to the latest year all-on.
  setSelectedDatacall: (dc: datacall | null) => void
  showDecommissioned: boolean
  setShowDecommissioned: (show: boolean) => void
  fetchFismaSystems: (decommissioned?: boolean) => Promise<void>
  // Search text driven from the header search box; the dashboard table reads
  // it as a controlled quick filter so both inputs stay in sync.
  dashboardSearch: string
  setDashboardSearch: (value: string) => void
  // Datacenter-environment vocabulary, fetched once at the layout level.
  // Empty until the fetch resolves; consumers fall back to raw values.
  datacenterEnvironments: DataCenterEnvironment[]
}

export function useContextProp() {
  return useOutletContext<ContextType>()
}
