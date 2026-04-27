import { apiClient } from './client'
import type { Vine, GeoJSONPoint } from '../types'

export async function listVines(rowId: string): Promise<Vine[]> {
  const res = await apiClient.get<Vine[]>(`/rows/${rowId}/vines`)
  return res.data
}

export async function createVine(rowId: string, data: {
  vineNumber: number
  position?: GeoJSONPoint
  notes?: string
}): Promise<Vine> {
  const res = await apiClient.post<Vine>(`/rows/${rowId}/vines`, data)
  return res.data
}

export async function nearbyVines(lat: number, lng: number, radius: number): Promise<Vine[]> {
  const res = await apiClient.get<Vine[]>(`/vines/nearby`, {
    params: { lat, lng, radius },
  })
  return res.data
}
