import { create } from 'zustand'
import { listEmployees, createEmployee, deleteEmployee } from '../api/employees'
import { listWorkTypes, createWorkType, deleteWorkType } from '../api/workTypes'
import { listTimeEntries, createTimeEntry, deleteTimeEntry, getTimeEntryStats } from '../api/timeEntries'
import type { CreateTimeEntryParams } from '../api/timeEntries'
import type { Employee, WorkType, TimeEntry, EmployeeMonthStats } from '../types'

interface PersonalState {
  employees: Employee[]
  workTypes: WorkType[]
  entries: TimeEntry[]
  stats: EmployeeMonthStats[]
  year: number
  loading: boolean
  error: string | null

  loadAll: () => Promise<void>
  setYear: (year: number) => void

  createEmployee: (name: string) => Promise<void>
  removeEmployee: (id: string) => Promise<void>

  createWorkType: (name: string) => Promise<void>
  removeWorkType: (id: string) => Promise<void>

  createEntry: (params: CreateTimeEntryParams) => Promise<void>
  removeEntry: (id: string) => Promise<void>
}

export const usePersonalStore = create<PersonalState>((set, get) => ({
  employees: [],
  workTypes: [],
  entries: [],
  stats: [],
  year: new Date().getFullYear(),
  loading: false,
  error: null,

  loadAll: async () => {
    set({ loading: true, error: null })
    try {
      const year = get().year
      const [employees, workTypes, entries, stats] = await Promise.all([
        listEmployees(),
        listWorkTypes(),
        listTimeEntries(year),
        getTimeEntryStats(year),
      ])
      set({ employees, workTypes, entries, stats })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Fehler beim Laden' })
    } finally {
      set({ loading: false })
    }
  },

  setYear: (year) => {
    set({ year })
    get().loadAll()
  },

  createEmployee: async (name) => {
    const e = await createEmployee(name)
    set((s) => ({ employees: [...s.employees, e].sort((a, b) => a.name.localeCompare(b.name)) }))
  },

  removeEmployee: async (id) => {
    await deleteEmployee(id)
    set((s) => ({ employees: s.employees.filter((e) => e.id !== id) }))
  },

  createWorkType: async (name) => {
    const wt = await createWorkType(name)
    set((s) => ({ workTypes: [...s.workTypes, wt].sort((a, b) => a.name.localeCompare(b.name)) }))
  },

  removeWorkType: async (id) => {
    await deleteWorkType(id)
    set((s) => ({ workTypes: s.workTypes.filter((wt) => wt.id !== id) }))
  },

  createEntry: async (params) => {
    const entry = await createTimeEntry(params)
    set((s) => {
      const entries = [entry, ...s.entries]
      // Recalculate stats optimistically
      const stats = recalcStats(s.employees, entries, s.year)
      return { entries, stats }
    })
  },

  removeEntry: async (id) => {
    await deleteTimeEntry(id)
    set((s) => {
      const entries = s.entries.filter((e) => e.id !== id)
      const stats = recalcStats(s.employees, entries, s.year)
      return { entries, stats }
    })
  },
}))

function recalcStats(employees: Employee[], entries: TimeEntry[], year: number): EmployeeMonthStats[] {
  return employees.map((emp) => {
    const months: [number, number, number, number, number, number, number, number, number, number, number, number] =
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    let total = 0
    for (const e of entries) {
      if (e.employeeId !== emp.id) continue
      const d = new Date(e.entryDate)
      if (d.getFullYear() !== year) continue
      const m = d.getMonth()
      months[m] += e.hours
      total += e.hours
    }
    return { employeeId: emp.id, employeeName: emp.name, months, total }
  })
}
