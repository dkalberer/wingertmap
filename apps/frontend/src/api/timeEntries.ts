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
