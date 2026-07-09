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
  selectedDatacall: datacall | null
  setSelectedDatacall: React.Dispatch<React.SetStateAction<datacall | null>>
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
