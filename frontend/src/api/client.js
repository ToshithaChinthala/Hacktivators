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

// Do NOT show toasts here — each page handles its own error toasting
// for user-initiated actions only.
api.interceptors.response.use(
  (res) => res,
  (err) => Promise.reject(err)
)

export default api

