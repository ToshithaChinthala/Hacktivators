import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi } from '../api/endpoints'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token') || null)
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)

  // Verify token validity on initial mount
  useEffect(() => {
    async function verify() {
      if (token) {
        try {
          const res = await authApi.getMe()
          setUser(res.data)
          localStorage.setItem('user', JSON.stringify(res.data))
        } catch {
          // Token is invalid/revoked
          setToken(null)
          setUser(null)
          localStorage.removeItem('token')
          localStorage.removeItem('user')
        }
      }
      setLoading(false)
    }
    verify()
  }, [token])

  const login = useCallback(async (email, password) => {
    const res = await authApi.login({ email, password })
    const { access_token, user: loggedUser } = res.data
    localStorage.setItem('token', access_token)
    localStorage.setItem('user', JSON.stringify(loggedUser))
    setToken(access_token)
    setUser(loggedUser)
    return res.data
  }, [])

  const register = useCallback(async (email, password, name) => {
    const res = await authApi.register({ email, password, name })
    const { access_token, user: newUser } = res.data
    localStorage.setItem('token', access_token)
    localStorage.setItem('user', JSON.stringify(newUser))
    setToken(access_token)
    setUser(newUser)
    return res.data
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // Ignore network/server errors during logout
    } finally {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setToken(null)
      setUser(null)
    }
  }, [])

  const value = {
    user,
    token,
    loading,
    isAuthenticated: Boolean(token && user),
    login,
    register,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
