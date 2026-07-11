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
  // The data calls whose scores/progress the dashboard aggregates — the active
  // year's calls, toggleable. selectedDatacall is the single active call when
  // exactly one is on (drives the single-id flows), else null while aggregating.
  activeDatacallIds: number[]
  selectedDatacall: datacall | null
  showDecommissioned: boolean
  setShowDecommissioned: (show: boolean) => void
  fetchFismaSystems: (decommissioned?: boolean) => Promise<void>
  // Datacenter-environment vocabulary, fetched once at the layout level.
  // Empty until the fetch resolves; consumers fall back to raw values.
  datacenterEnvironments: DataCenterEnvironment[]
}

export function useContextProp() {
  return useOutletContext<ContextType>()
}
