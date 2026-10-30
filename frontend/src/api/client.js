import axios from 'axios'

// Use relative base URL so all requests go through the Vite dev server proxy
// (localhost:5173/api → proxy → localhost:8000/api).
// This avoids IPv6 vs IPv4 localhost resolution mismatches and CORS preflight issues.
// In production, set VITE_API_BASE_URL to the absolute backend URL.
const BASE_URL = import.meta.env.VITE_API_BASE_URL === 'http://localhost:8000'
  ? ''   // dev: use Vite proxy
  : (import.meta.env.VITE_API_BASE_URL || '')

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// Attach Bearer token from localStorage to every outgoing request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Handle 401 Unauthorized globally (session expired or invalid token)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401) {
      const isAuthEndpoint =
        err.config?.url?.includes('/api/auth/login') ||
        err.config?.url?.includes('/api/auth/register')
      if (!isAuthEndpoint) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(err)
  }
)

export default api
