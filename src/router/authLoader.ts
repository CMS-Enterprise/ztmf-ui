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
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }
    if (process.env.NODE_ENV === 'development') {
      headers['Authorization'] =
        `Bearer ${import.meta.env.VITE_AUTH_TOKEN3 || ''}`
    }
    const axiosUser = await fetch('/whoami', { headers })
    if (axiosUser.status === 403 || axiosUser.status === 401) {
      // Redirect to /login if the status is 403
      return window.location.hostname + '/login'
    }
    // if (axiosUser.status !== 200) {
    //   return { ok: false, response: emptyUser }
    // }
    const axiosUserBody = await axiosUser.text()
    const userEmail = jwtDecode(
      axiosUserBody.split(' ')[1] as string
    ) as userData
    const userInfo = await axiosInstance.get(`/users/${userEmail.email}`)
    if (userInfo.status != 200) {
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
