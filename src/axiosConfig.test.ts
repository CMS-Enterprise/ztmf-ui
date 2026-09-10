import type { AxiosInstance } from 'axios'

/** Mocked so importing axiosConfig does not pull the router graph the real
 * interceptor needs; these tests only exercise instance configuration.
 */
jest.mock('@/utils/authInterceptor', () => ({
  handleAuthError: jest.fn(),
}))

/** Imports the module fresh so each test controls the runtime config the
 * instance is built from (the token is read once at module init).
 */
function loadAxiosInstance(): AxiosInstance {
  let instance: AxiosInstance | undefined
  jest.isolateModules(() => {
    instance = require('./axiosConfig').default
  })
  return instance as AxiosInstance
}

describe('axiosConfig', () => {
  afterEach(() => {
    delete window.ZTMF_RUNTIME_CONFIG
  })

  it('uses a relative baseURL so requests resolve against the document URL', () => {
    expect(loadAxiosInstance().defaults.baseURL).toBe('api/v1/')
  })

  it('attaches the bearer token when the runtime config provides one', () => {
    window.ZTMF_RUNTIME_CONFIG = { authToken: 'runtime-test-token' }
    expect(loadAxiosInstance().defaults.headers.common['Authorization']).toBe(
      'Bearer runtime-test-token'
    )
  })

  it('sets no Authorization header without a runtime config', () => {
    expect(
      loadAxiosInstance().defaults.headers.common['Authorization']
    ).toBeUndefined()
  })

  it('sets no Authorization header when the runtime config has no token', () => {
    window.ZTMF_RUNTIME_CONFIG = {}
    expect(
      loadAxiosInstance().defaults.headers.common['Authorization']
    ).toBeUndefined()
  })
})
