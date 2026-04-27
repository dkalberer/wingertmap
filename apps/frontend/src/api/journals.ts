import { apiClient } from './client'
import type { VintageJournal } from '../types'

export async function listJournals(vineyardId: string): Promise<VintageJournal[]> {
  const res = await apiClient.get<VintageJournal[]>(`/vineyards/${vineyardId}/journals`)
  return res.data
}

export async function getJournalByYear(vineyardId: string, year: number): Promise<VintageJournal | null> {
  const res = await apiClient.get<VintageJournal | null>(`/vineyards/${vineyardId}/journals/${year}`)
  return res.data
}

export async function upsertJournal(vineyardId: string, year: number, notes: string): Promise<VintageJournal> {
  const res = await apiClient.put<VintageJournal>(`/vineyards/${vineyardId}/journals/${year}`, { notes })
  return res.data
}
