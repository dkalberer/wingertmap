import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from './authStore'

describe('authStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false, isLoading: false })
  })

  it('login sets token and user', async () => {
    await useAuthStore.getState().login({ email: 'test@example.com', password: 'pw' })
    const state = useAuthStore.getState()
    expect(state.token).toBe('mock-jwt-token')
    expect(state.user?.email).toBe('test@example.com')
    expect(state.isAuthenticated).toBe(true)
    expect(localStorage.getItem('token')).toBe('mock-jwt-token')
  })

  it('logout clears token and user', async () => {
    await useAuthStore.getState().login({ email: 'test@example.com', password: 'pw' })
    useAuthStore.getState().logout()
    const state = useAuthStore.getState()
    expect(state.token).toBeNull()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('hydrate restores user from token', async () => {
    localStorage.setItem('token', 'mock-jwt-token')
    await useAuthStore.getState().hydrate()
    const state = useAuthStore.getState()
    expect(state.user?.email).toBe('test@example.com')
    expect(state.isAuthenticated).toBe(true)
  })
})
