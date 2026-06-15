import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { AuthUser, LoginCredentials, SignUpData } from '@/types'
import * as authApi from '@/api/auth'

interface AuthContextType {
  user: AuthUser | null
  isLoading: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  signup: (data: SignUpData) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
  getIdToken: () => string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check if user is already logged in
    const currentUser = authApi.getCurrentUser()
    setUser(currentUser)
    setIsLoading(false)
  }, [])

  const login = async (credentials: LoginCredentials) => {
    const authUser = await authApi.signIn(credentials)
    setUser(authUser)
  }

  const signup = async (data: SignUpData) => {
    await authApi.signUp(data)
  }

  const logout = () => {
    authApi.signOut()
    setUser(null)
  }

  const getIdToken = (): string | null => {
    return localStorage.getItem('auth_token')
  }

  const value: AuthContextType = {
    user,
    isLoading,
    login,
    signup,
    logout,
    isAuthenticated: authApi.isAuthenticated(),
    getIdToken,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
