import { apiClient } from './client'
import type { PruningRecord, SchnittTyp } from '../types'

export interface CreatePruningParams {
  year: number
  pruningDate: string
  schnittTyp: SchnittTyp
  augenProRebe?: number
  notes?: string
}

export interface UpdatePruningParams {
  year: number
  pruningDate: string
  schnittTyp: SchnittTyp
  augenProRebe?: number
  notes?: string
}

export async function listPruning(vineyardId: string): Promise<PruningRecord[]> {
  const res = await apiClient.get<PruningRecord[]>(`/vineyards/${vineyardId}/pruning`)
  return res.data
}

export async function createPruning(vineyardId: string, params: CreatePruningParams): Promise<PruningRecord> {
  const res = await apiClient.post<PruningRecord>(`/vineyards/${vineyardId}/pruning`, params)
  return res.data
}

export async function updatePruning(id: string, params: UpdatePruningParams): Promise<PruningRecord> {
  const res = await apiClient.put<PruningRecord>(`/pruning/${id}`, params)
  return res.data
}

export async function deletePruning(id: string): Promise<void> {
  await apiClient.delete(`/pruning/${id}`)
}
