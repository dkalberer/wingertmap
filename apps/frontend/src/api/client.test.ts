import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server'
import { apiClient } from './client'

describe('apiClient', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('does not set Authorization header when no token', async () => {
    let authHeader: string | null = null
    server.use(
      http.get('/api/test', ({ request }) => {
        authHeader = request.headers.get('Authorization')
        return HttpResponse.json({})
      }),
    )
    await apiClient.get('/test')
    expect(authHeader).toBeNull()
  })

  it('sets Authorization header when token is in localStorage', async () => {
    localStorage.setItem('token', 'my-jwt')
    let authHeader: string | null = null
    server.use(
      http.get('/api/test', ({ request }) => {
        authHeader = request.headers.get('Authorization')
        return HttpResponse.json({})
      }),
    )
    await apiClient.get('/test')
    expect(authHeader).toBe('Bearer my-jwt')
  })

  it('removes token from localStorage on 401', async () => {
    localStorage.setItem('token', 'expired-token')
    server.use(
      http.get('/api/test', () => {
        return HttpResponse.json({ error: 'unauthorized' }, { status: 401 })
      }),
    )
    try {
      await apiClient.get('/test')
    } catch {
      // expected
    }
    expect(localStorage.getItem('token')).toBeNull()
  })
})
