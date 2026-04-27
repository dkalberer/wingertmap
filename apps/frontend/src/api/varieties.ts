import { apiClient } from './client'
import type { GrapeVariety, GrapeColor } from '../types'

export async function listVarieties(): Promise<GrapeVariety[]> {
  const res = await apiClient.get<GrapeVariety[]>('/varieties')
  return res.data
}

export async function createVariety(name: string, color: GrapeColor): Promise<GrapeVariety> {
  const res = await apiClient.post<GrapeVariety>('/varieties', { name, color })
  return res.data
}

export async function deleteVariety(id: string): Promise<void> {
  await apiClient.delete(`/varieties/${id}`)
}
