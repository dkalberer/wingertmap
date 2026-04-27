import { apiClient } from './client'
import type { WorkType } from '../types'

export async function listWorkTypes(): Promise<WorkType[]> {
  const res = await apiClient.get<WorkType[]>('/work-types')
  return res.data
}

export async function createWorkType(name: string): Promise<WorkType> {
  const res = await apiClient.post<WorkType>('/work-types', { name })
  return res.data
}

export async function deleteWorkType(id: string): Promise<void> {
  await apiClient.delete(`/work-types/${id}`)
}
