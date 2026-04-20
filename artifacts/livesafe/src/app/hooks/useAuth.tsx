import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'
import { tokenStore } from '@/lib/tokenStore'
import { api } from '@/app/services/api'
import type { User, AuthState } from '@/types'

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,
  })

  useEffect(() => {
    const restoredUser = tokenStore.getUser<User>()
    const restoredToken = tokenStore.getToken()

    if (restoredUser && restoredToken) {
      setState({
        user: restoredUser,
        token: restoredToken,
        isLoading: false,
        isAuthenticated: true,
      })
    } else {
      setState((s) => ({ ...s, isLoading: false }))
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, isLoading: true }))
    try {
      const { user, token } = await api.login(email, password)
      tokenStore.setToken(token)
      tokenStore.setUser(user)
      setState({ user, token, isLoading: false, isAuthenticated: true })
    } catch (err) {
      setState((s) => ({ ...s, isLoading: false }))
      throw err
    }
  }, [])

  const register = useCallback(async (name: string, email: string, password: string) => {
    setState((s) => ({ ...s, isLoading: true }))
    try {
      const { user, token } = await api.register(name, email, password)
      tokenStore.setToken(token)
      tokenStore.setUser(user)
      setState({ user, token, isLoading: false, isAuthenticated: true })
    } catch (err) {
      setState((s) => ({ ...s, isLoading: false }))
      throw err
    }
  }, [])

  const logout = useCallback(async () => {
    await api.logout()
    tokenStore.clear()
    setState({ user: null, token: null, isLoading: false, isAuthenticated: false })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
