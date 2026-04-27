import { apiClient } from './client'

export interface TaskPhoto {
  id: string
  objectKey: string
  url: string
  createdAt: string
}

export async function listPhotos(taskId: string): Promise<TaskPhoto[]> {
  const res = await apiClient.get<TaskPhoto[]>(`/tasks/${taskId}/photos`)
  return res.data
}

export async function uploadPhoto(taskId: string, file: File): Promise<TaskPhoto> {
  const form = new FormData()
  form.append('photo', file)
  const res = await apiClient.post<TaskPhoto>(`/tasks/${taskId}/photos`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}
