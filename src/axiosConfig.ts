import axios, { AxiosInstance } from 'axios'

const axiosInstance: AxiosInstance = axios.create({
  baseURL: '/api/v1/',
  headers: {
    'Content-Type': 'application/json',
  },
  // withCredentials: true,
})

// Set the Authorization header conditionally based on the environment
if (process.env.NODE_ENV === 'development') {
  axiosInstance.defaults.headers.common['Authorization'] =
    `Bearer ${import.meta.env.VITE_AUTH_TOKEN3 || ''}`
}

export default axiosInstance
