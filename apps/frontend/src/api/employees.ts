import { apiClient } from './client'
import type { Employee } from '../types'

export async function listEmployees(): Promise<Employee[]> {
  const res = await apiClient.get<Employee[]>('/employees')
  return res.data
}

export async function createEmployee(name: string): Promise<Employee> {
  const res = await apiClient.post<Employee>('/employees', { name })
  return res.data
}

export async function deleteEmployee(id: string): Promise<void> {
  await apiClient.delete(`/employees/${id}`)
}
