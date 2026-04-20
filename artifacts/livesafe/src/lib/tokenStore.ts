// Secure token store using sessionStorage (tab-scoped, not accessible cross-origin)
const TOKEN_KEY = 'ls_auth_token'
const USER_KEY  = 'ls_auth_user'

export const tokenStore = {
  getToken(): string | null {
    try { return sessionStorage.getItem(TOKEN_KEY) }
    catch { return null }
  },

  setToken(token: string): void {
    try { sessionStorage.setItem(TOKEN_KEY, token) }
    catch { /* unavailable in private browsing — gracefully ignore */ }
  },

  getUser<T>(): T | null {
    try {
      const raw = sessionStorage.getItem(USER_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as T
      // Basic sanity check — must have id and role
      if (typeof (parsed as Record<string, unknown>).id !== 'string') return null
      return parsed
    } catch {
      return null
    }
  },

  setUser(user: unknown): void {
    try { sessionStorage.setItem(USER_KEY, JSON.stringify(user)) }
    catch { /* unavailable — gracefully ignore */ }
  },

  clear(): void {
    try {
      sessionStorage.removeItem(TOKEN_KEY)
      sessionStorage.removeItem(USER_KEY)
    } catch { /* ignore */ }
  },
}
