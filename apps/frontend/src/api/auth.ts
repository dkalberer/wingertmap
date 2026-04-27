import { apiClient } from './client'
import type { AuthResponse, LoginRequest, RegisterRequest, User } from '../types'

export async function login(data: LoginRequest): Promise<AuthResponse> {
  const res = await apiClient.post<AuthResponse>('/auth/login', data)
  return res.data
}

export async function register(data: RegisterRequest): Promise<User> {
  const res = await apiClient.post<User>('/auth/register', data)
  return res.data
}

export async function getMe(): Promise<User> {
  const res = await apiClient.get<User>('/auth/me')
  return res.data
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.post('/auth/change-password', { currentPassword, newPassword })
}
