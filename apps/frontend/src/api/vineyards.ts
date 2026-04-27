import { apiClient } from './client'
import type { Vineyard, GeoJSONPolygon } from '../types'

export async function listVineyards(): Promise<Vineyard[]> {
  const res = await apiClient.get<Vineyard[]>('/vineyards')
  return res.data
}

export async function createVineyard(data: {
  name: string
  description?: string
  boundary?: GeoJSONPolygon
}): Promise<Vineyard> {
  const res = await apiClient.post<Vineyard>('/vineyards', data)
  return res.data
}

export async function getVineyard(id: string): Promise<Vineyard> {
  const res = await apiClient.get<Vineyard>(`/vineyards/${id}`)
  return res.data
}

export async function updateVineyard(
  id: string,
  data: { name: string; description?: string; boundary?: GeoJSONPolygon },
): Promise<Vineyard> {
  const res = await apiClient.put<Vineyard>(`/vineyards/${id}`, data)
  return res.data
}

export async function deleteVineyard(id: string): Promise<void> {
  await apiClient.delete(`/vineyards/${id}`)
}
