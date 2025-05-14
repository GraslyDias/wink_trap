'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { verifySession, loginUser, logoutUser } from './api'

// Create authentication context
const AuthContext = createContext()

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Helper function to safely use localStorage (browser-only)
const safeLocalStorage = {
  getItem: (key) => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem(key)
      } catch (e) {
        console.error('Error accessing localStorage:', e)
        return null
      }
    }
    return null
  },
  setItem: (key, value) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(key, value)
      } catch (e) {
        console.error('Error setting localStorage:', e)
      }
    }
  },
  removeItem: (key) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(key)
      } catch (e) {
        console.error('Error removing from localStorage:', e)
      }
    }
  }
}

// Add a session cookie helper
const sessionCookie = {
  get: (name) => {
    if (typeof document === 'undefined') return null
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
    return match ? match[2] : null
  },
  exists: (name) => {
    if (typeof document === 'undefined') return false
    return document.cookie.split(';').some(c => c.trim().startsWith(name + '='))
  }
}

export function AuthProvider({ children }) {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sessionChecked, setSessionChecked] = useState(false)

  // Effect to check if user is authenticated on page load
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        setLoading(true)
        
        // Check for PHP session cookie which would indicate an active server session
        const hasSessionCookie = sessionCookie.exists('PHPSESSID') || 
                                sessionCookie.exists('wink_session');
                                
        console.log('Session cookie exists:', hasSessionCookie);
        
        // Check if user exists in localStorage first (quick check)
        const storedUser = safeLocalStorage.getItem('user')
        let parsedUser = null;
        
        if (storedUser) {
          try {
            parsedUser = JSON.parse(storedUser)
            setUser(parsedUser)
            console.log('User loaded from localStorage:', parsedUser);
          } catch (e) {
            console.error('Failed to parse stored user data:', e)
            safeLocalStorage.removeItem('user')
          }
        }
        
        // Verify session with the server - but only if we have a cookie or user data
        // This prevents unnecessary API calls on fresh visits
        if (hasSessionCookie || parsedUser) {
          console.log('Verifying server session...');
          const response = await verifySession()
          console.log('Verify session response:', response)
          
          if (response.success) {
            // Update user data from server if different
            setUser(response.data.user)
            safeLocalStorage.setItem('user', JSON.stringify(response.data.user))
            // Store auth token if provided
            if (response.data.token) {
              safeLocalStorage.setItem('auth_token', response.data.token)
            }
          } else {
            // Only clear if we tried a verification and it failed
            console.log('Session verification failed, clearing user data');
            setUser(null)
            safeLocalStorage.removeItem('user')
            safeLocalStorage.removeItem('auth_token')
          }
        } else if (!hasSessionCookie && !parsedUser) {
          // No session or stored user data, ensure user is null
          console.log('No session cookie or stored user, setting user to null');
          setUser(null)
        }
      } catch (err) {
        console.error('Auth check error:', err)
        setError('Failed to verify authentication status')
        // Don't clear user data on network errors to allow offline access
        if (err.message && !err.message.includes('network')) {
          setUser(null)
          safeLocalStorage.removeItem('user')
          safeLocalStorage.removeItem('auth_token')
        }
      } finally {
        setLoading(false)
        setSessionChecked(true)
      }
    }

    // Only run in browser
    if (typeof window !== 'undefined') {
      checkAuthStatus()
    } else {
      setLoading(false)
      setSessionChecked(true)
    }
  }, [])

  // Login function
  const login = async (credentials) => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('Logging in with credentials:', { email: credentials.email })
      const response = await loginUser(credentials)
      console.log('Login response:', response)
      
      if (response.success) {
        // Save user data
        const userData = response.data.user || {}
        setUser(userData)
        safeLocalStorage.setItem('user', JSON.stringify(userData))
        
        // Save auth token if provided
        if (response.data.token) {
          safeLocalStorage.setItem('auth_token', response.data.token)
        }
        
        return { success: true, message: 'Login successful' }
      } else {
        setError(response.data?.message || 'Login failed')
        return { 
          success: false, 
          message: response.data?.message || 'Login failed' 
        }
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('An unexpected error occurred')
      return { success: false, message: 'An unexpected error occurred' }
    } finally {
      setLoading(false)
    }
  }

  // Logout function
  const logout = async () => {
    try {
      setLoading(true)
      await logoutUser()
      setUser(null)
      safeLocalStorage.removeItem('user')
      safeLocalStorage.removeItem('auth_token')
      return { success: true }
    } catch (err) {
      console.error('Logout error:', err)
      // Still clear local data even on API error
      setUser(null)
      safeLocalStorage.removeItem('user')
      safeLocalStorage.removeItem('auth_token')
      return { success: true, message: 'Logged out locally' }
    } finally {
      setLoading(false)
    }
  }

  // Check if user is authenticated
  const isAuthenticated = () => {
    // Only consider authenticated after session check is complete
    if (!sessionChecked) return false
    return !!user
  }
  
  // Debug function to manually set user data (for testing)
  const debugSetUser = (userData) => {
    if (process.env.NODE_ENV !== 'production') {
      setUser(userData)
      if (userData) {
        safeLocalStorage.setItem('user', JSON.stringify(userData))
      } else {
        safeLocalStorage.removeItem('user')
      }
    }
  }

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    isAuthenticated,
    debugSetUser,
    sessionChecked
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
} 