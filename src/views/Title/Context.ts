import { useOutletContext } from 'react-router-dom'
import { FismaSystemType, userData } from '@/types'

type ContextType = {
  fismaSystems: FismaSystemType[] | []
  userInfo: userData
  latestDataCallId: number
  latestDatacall: string
  showDecommissioned: boolean
  setShowDecommissioned: (show: boolean) => void
  fetchFismaSystems: (decommissioned?: boolean) => Promise<void>
}

export function useContextProp() {
  return useOutletContext<ContextType>()
}
