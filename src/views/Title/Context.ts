import React from 'react'
import { useOutletContext } from 'react-router-dom'
import { FismaSystemType, userData, datacall } from '@/types'

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
}

export function useContextProp() {
  return useOutletContext<ContextType>()
}
