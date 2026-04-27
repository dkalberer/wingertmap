import { create } from 'zustand'
import { login as apiLogin, register as apiRegister, getMe } from '../api/auth'
import type { User, LoginRequest, RegisterRequest } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (data: LoginRequest) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  logout: () => void
  hydrate: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null,
  isAuthenticated: typeof localStorage !== 'undefined' ? !!localStorage.getItem('token') : false,
  isLoading: false,

  login: async (data) => {
    set({ isLoading: true })
    const res = await apiLogin(data)
    localStorage.setItem('token', res.token)
    set({ token: res.token, user: res.user, isAuthenticated: true, isLoading: false })
  },

  register: async (data) => {
    set({ isLoading: true })
    await apiRegister(data)
    set({ isLoading: false })
  },

  logout: () => {
    localStorage.removeItem('token')
    set({ token: null, user: null, isAuthenticated: false })
  },

  hydrate: async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    try {
      const user = await getMe()
      set({ user, isAuthenticated: true })
    } catch {
      localStorage.removeItem('token')
      set({ token: null, user: null, isAuthenticated: false })
    }
  },
}))
