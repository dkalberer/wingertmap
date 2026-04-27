import { apiClient } from './client'
import type { TimeEntry, EmployeeMonthStats } from '../types'

export interface CreateTimeEntryParams {
  employeeId: string
  workTypeId?: string
  vineyardId?: string
  entryDate: string
  hours: number
  description?: string
}

export async function listTimeEntries(year: number): Promise<TimeEntry[]> {
  const res = await apiClient.get<TimeEntry[]>(`/time-entries?year=${year}`)
  return res.data
}

export async function createTimeEntry(params: CreateTimeEntryParams): Promise<TimeEntry> {
  const res = await apiClient.post<TimeEntry>('/time-entries', params)
  return res.data
}

export async function deleteTimeEntry(id: string): Promise<void> {
  await apiClient.delete(`/time-entries/${id}`)
}

export async function getTimeEntryStats(year: number): Promise<EmployeeMonthStats[]> {
  const res = await apiClient.get<EmployeeMonthStats[]>(`/time-entries/stats?year=${year}`)
  return res.data
}

export async function exportTimeEntries(year: number): Promise<void> {
  const token = localStorage.getItem('token')
  const res = await fetch(`/api/time-entries/export?year=${year}`, {
    headers: { Authorization: `Bearer ${token ?? ''}` },
  })
  if (!res.ok) throw new Error('Export fehlgeschlagen')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `stunden_${year}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export interface ImportResult {
  imported: number
  skipped: number
  errors?: string[]
}

export async function importTimeEntries(file: File): Promise<ImportResult> {
  const form = new FormData()
  form.append('file', file)
  const res = await apiClient.post<ImportResult>('/time-entries/import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}
