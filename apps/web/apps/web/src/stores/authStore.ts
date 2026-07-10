import { create } from 'zustand'

interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'monitor' | 'coordinator'
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (token: string, user: User) => void
  logout: () => void
}

const stored = localStorage.getItem('qp_user')
const storedToken = localStorage.getItem('qp_token')

export const useAuthStore = create<AuthState>((set) => ({
  user: stored ? JSON.parse(stored) : null,
  token: storedToken,
  isAuthenticated: !!storedToken,

  login: (token, user) => {
    localStorage.setItem('qp_token', token)
    localStorage.setItem('qp_user', JSON.stringify(user))
    set({ token, user, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('qp_token')
    localStorage.removeItem('qp_user')
    set({ token: null, user: null, isAuthenticated: false })
  },
}))
