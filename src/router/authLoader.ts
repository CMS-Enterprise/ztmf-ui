import 'core-js/stable/atob'
import { userData, UserRole } from '@/types'
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
  role: '' as UserRole,
  assignedfismasystems: [],
}
const authLoader = async () => {
  try {
    // skipAuthHandling: the centralized 401-redirect interceptor would
    // hijack this call's 401 with router.navigate('/signin'), which
    // re-runs this loader on the new route and creates an infinite
    // redirect loop. authLoader is the OWNER of the session-expired
    // decision: a 401 here means "render LoginPage as a child route"
    // (via the { ok: false, response: emptyUser } return below), not
    // "redirect away."
    const axiosUser = await axiosInstance.get('/users/current', {
      skipAuthHandling: true,
    })
    if (axiosUser.status != 200) {
      return { ok: false, response: emptyUser }
    }
    return { status: axiosUser.status, response: axiosUser.data.data }
  } catch (error: unknown) {
    const err = error as { response?: { status?: number }; status?: number }
    const status = err?.response?.status || err?.status || 0
    if (status >= 500 || status === 0) {
      return { status, serverError: true, response: emptyUser }
    }
    console.error('Error:', error)
  }
  return { ok: false, response: emptyUser }
}

export default authLoader
