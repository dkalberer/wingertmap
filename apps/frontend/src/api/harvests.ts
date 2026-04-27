import { apiClient } from './client'
import type { Harvest } from '../types'

export interface CreateHarvestParams {
  varietyId: string
  harvestDate: string
  weightKg: number
  oechsle?: number
  notes?: string
}

export async function listHarvests(vineyardId: string): Promise<Harvest[]> {
  const res = await apiClient.get<Harvest[]>(`/vineyards/${vineyardId}/harvests`)
  return res.data
}

export async function createHarvest(vineyardId: string, params: CreateHarvestParams): Promise<Harvest> {
  const res = await apiClient.post<Harvest>(`/vineyards/${vineyardId}/harvests`, params)
  return res.data
}

export async function updateHarvest(id: string, params: CreateHarvestParams): Promise<Harvest> {
  const res = await apiClient.put<Harvest>(`/harvests/${id}`, params)
  return res.data
}

export async function deleteHarvest(id: string): Promise<void> {
  await apiClient.delete(`/harvests/${id}`)
}
