import { useOutletContext } from 'react-router-dom'
import { FismaSystemType, userData } from '@/types'

type ContextType = {
  fismaSystems: FismaSystemType[] | []
  userInfo: userData
}

export function useContextProp() {
  return useOutletContext<ContextType>()
}
