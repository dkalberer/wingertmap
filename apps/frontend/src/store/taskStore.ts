import { create } from 'zustand'
import { allTasks, createTask, updateTaskStatus, deleteTask } from '../api/tasks'
import type { CreateTaskParams } from '../api/tasks'
import type { Task, TaskStatus } from '../types'

interface TaskState {
  tasks: Task[]
  loading: boolean
  error: string | null
  load: () => Promise<void>
  create: (params: CreateTaskParams) => Promise<Task>
  changeStatus: (id: string, status: TaskStatus) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  loading: false,
  error: null,

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
    set((s) => ({ tasks: [t, ...s.tasks] }))
    return t
  },

  changeStatus: async (id, status) => {
    const updated = await updateTaskStatus(id, status)
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? updated : t)) }))
  },

  remove: async (id) => {
    await deleteTask(id)
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
  },
}))
