import { useOutletContext } from 'react-router-dom'
import { FismaSystemType } from '@/types'

type ContextType = { fismaSystems: FismaSystemType[] | [] }

export function useFismaSystems() {
  return useOutletContext<ContextType>()
}
