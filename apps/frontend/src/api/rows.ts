import { apiClient } from './client'
import type { Row, RowStatus, GeoJSONLineString } from '../types'

export async function listRows(vineyardId: string): Promise<Row[]> {
  const res = await apiClient.get<Row[]>(`/vineyards/${vineyardId}/rows`)
  return res.data
}

export async function createRow(vineyardId: string, data: {
  line?: GeoJSONLineString
  variety?: string
}): Promise<Row> {
  const res = await apiClient.post<Row>(`/vineyards/${vineyardId}/rows`, data)
  return res.data
}

export async function updateRowStatus(id: string, status: RowStatus): Promise<void> {
  await apiClient.patch(`/rows/${id}/status`, { status })
}

export async function updateRowLine(id: string, line: GeoJSONLineString): Promise<void> {
  await apiClient.patch(`/rows/${id}/line`, { line })
}

export async function confirmAllRows(vineyardId: string): Promise<void> {
  await apiClient.post(`/vineyards/${vineyardId}/rows/confirm-all`, {})
}

export async function deleteRow(id: string): Promise<void> {
  await apiClient.delete(`/rows/${id}`)
}
