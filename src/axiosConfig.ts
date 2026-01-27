import axios, { AxiosInstance } from 'axios'

const axiosInstance: AxiosInstance = axios.create({
  baseURL: '/api/v1/',
  headers: {
    'Content-Type': 'application/json',
  },
  // withCredentials: true,
})

// Local development only: bypass auth with token from .env
// This will NOT run in AWS dev/prod builds - only when running `yarn dev` locally
if (import.meta.env.VITE_LOCAL_DEV === 'true') {
  axiosInstance.defaults.headers.common['Authorization'] =
    `Bearer ${import.meta.env.VITE_AUTH_TOKEN3 || ''}`
}

export default axiosInstance
