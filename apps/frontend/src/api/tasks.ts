import { apiClient } from './client'
import type { Task, TaskStatus, GeoJSONPoint, RecordType, TaskCategory, Severity } from '../types'

export async function listTasks(vineId: string): Promise<Task[]> {
  const res = await apiClient.get<Task[]>(`/vines/${vineId}/tasks`)
  return res.data
}

export interface CreateTaskParams {
  title: string
  recordType: RecordType
  category: TaskCategory
  severity?: Severity
  phase?: string
  notes?: string
  dueDate?: string
  location?: GeoJSONPoint
  vineyardId?: string
}

export async function createTask(params: CreateTaskParams): Promise<Task> {
  const res = await apiClient.post<Task>('/tasks', params)
  return res.data
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
  const res = await apiClient.patch<Task>(`/tasks/${id}/status`, { status })
  return res.data
}

export async function allTasks(): Promise<Task[]> {
  const res = await apiClient.get<Task[]>('/tasks')
  return res.data
}

export async function deleteTask(id: string): Promise<void> {
  await apiClient.delete(`/tasks/${id}`)
}
