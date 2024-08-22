import 'core-js/stable/atob'
import { jwtDecode } from 'jwt-decode'
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
    const axiosUser = await axiosInstance.get('/whoami')
    if (!axiosUser.statusText) {
      return { ok: false, response: emptyUser }
    }
    const userEmail = jwtDecode(
      axiosUser.data.split(' ')[1] as string
    ) as userData
    const userInfo = await axiosInstance.get(`/users/${userEmail.email}`)
    if (!userInfo.statusText) {
      return { ok: false, response: emptyUser }
    }
    const userInfoBody = userInfo.data
    const userOk = userInfo.statusText
    return { ok: userOk, response: userInfoBody }
  } catch (error) {
    console.error('Error:', error)
  }
  return { ok: false, response: emptyUser }
}

export default authLoader
