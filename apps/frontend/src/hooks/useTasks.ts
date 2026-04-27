import { useState, useEffect, useCallback } from 'react'
import { allTasks, createTask, updateTaskStatus, deleteTask } from '../api/tasks'
import type { CreateTaskParams } from '../api/tasks'
import type { Task, TaskStatus } from '../types'

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await allTasks()
      setTasks(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const create = useCallback(async (params: CreateTaskParams) => {
    const t = await createTask(params)
    setTasks((prev) => [t, ...prev])
    return t
  }, [])

  const changeStatus = useCallback(async (id: string, status: TaskStatus) => {
    const updated = await updateTaskStatus(id, status)
    setTasks((prev) => prev.map((t) => t.id === id ? updated : t))
    return updated
  }, [])

  const remove = useCallback(async (id: string) => {
    await deleteTask(id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { tasks, loading, error, create, changeStatus, remove, reload: load }
}
