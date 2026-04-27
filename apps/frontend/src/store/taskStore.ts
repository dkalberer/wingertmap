import { create } from 'zustand'
import { allTasks, createTask, updateTaskStatus, deleteTask } from '../api/tasks'
import type { CreateTaskParams } from '../api/tasks'
import type { Task, TaskStatus } from '../types'

interface Notification {
  message: string
  severity: 'success' | 'error'
}

interface TaskState {
  tasks: Task[]
  loading: boolean
  error: string | null
  notification: Notification | null
  load: () => Promise<void>
  create: (params: CreateTaskParams) => Promise<Task>
  changeStatus: (id: string, status: TaskStatus) => Promise<void>
  remove: (id: string) => Promise<void>
  clearNotification: () => void
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  loading: false,
  error: null,
  notification: null,

  clearNotification: () => set({ notification: null }),

  load: async () => {
    set({ loading: true, error: null })
    try {
      const data = await allTasks()
      set({ tasks: data })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Fehler beim Laden' })
    } finally {
      set({ loading: false })
    }
  },

  create: async (params) => {
    const t = await createTask(params)
    set((s) => ({ tasks: [t, ...s.tasks], notification: { message: 'Aufgabe erstellt', severity: 'success' } }))
    return t
  },

  changeStatus: async (id, status) => {
    const prev = get().tasks.find((t) => t.id === id)
    // Optimistic update
    set((s) => ({ tasks: s.tasks.map((t) => t.id === id ? { ...t, status } : t) }))
    try {
      const updated = await updateTaskStatus(id, status)
      set((s) => ({ tasks: s.tasks.map((t) => t.id === id ? updated : t) }))
    } catch (e: unknown) {
      // Rollback
      if (prev) set((s) => ({ tasks: s.tasks.map((t) => t.id === id ? prev : t) }))
      set({ notification: { message: 'Fehler beim Aktualisieren', severity: 'error' } })
    }
  },

  remove: async (id) => {
    await deleteTask(id)
    set((s) => ({
      tasks: s.tasks.filter((t) => t.id !== id),
      notification: { message: 'Aufgabe gelöscht', severity: 'success' },
    }))
  },
}))
