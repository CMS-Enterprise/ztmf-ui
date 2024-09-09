import 'core-js/stable/atob'
import { userData } from '@/types'
import axiosInstance from '@/axiosConfig'
/**
 * Auth state loader for react-router data routes.
 * @module router/authLoader
 * @see {@link dashboard/Routes}
 */

const emptyUser: userData = {
  userid: '',
  email: '',
  fullname: '',
  role: '',
  assignedfismasystems: [],
}
const authLoader = async (): Promise<unknown> => {
  try {
    const axiosUser = await axiosInstance.get('/users/current')
    if (axiosUser.status != 200) {
      return { ok: false, response: emptyUser }
    }
    return { status: axiosUser.status, response: axiosUser.data.data }
  } catch (error) {
    console.error('Error:', error)
  }
  return { ok: false, response: emptyUser }
}

export default authLoader
