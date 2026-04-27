import { describe, it, expect, beforeEach } from 'vitest'
import { login, register, getMe } from './auth'

describe('auth api', () => {
  beforeEach(() => localStorage.clear())

  it('login returns token and user', async () => {
    const res = await login({ email: 'test@example.com', password: 'pw' })
    expect(res.token).toBe('mock-jwt-token')
    expect(res.user.email).toBe('test@example.com')
  })

  it('register returns user', async () => {
    const user = await register({ email: 'test@example.com', name: 'Test', password: 'pw' })
    expect(user.email).toBe('test@example.com')
  })

  it('getMe returns current user', async () => {
    const user = await getMe()
    expect(user.id).toBe('user-1')
  })
})
