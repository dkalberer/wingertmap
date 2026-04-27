import { useState, useEffect, useCallback } from 'react'
import { listRows, createRow, deleteRow } from '../api/rows'
import type { Row, GeoJSONLineString } from '../types'

export function useRows(vineyardId: string) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!vineyardId) return
    setLoading(true)
    try {
      const data = await listRows(vineyardId)
      setRows(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [vineyardId])

  useEffect(() => { load() }, [load])

  const create = useCallback(async (_rowNumber: number, line?: GeoJSONLineString, variety?: string) => {
    const r = await createRow(vineyardId, { line, variety })
    setRows((prev) => [...prev, r])
    return r
  }, [vineyardId])

  const remove = useCallback(async (id: string) => {
    await deleteRow(id)
    setRows((prev) => prev.filter((r) => r.id !== id))
  }, [])

  return { rows, loading, error, create, remove, reload: load }
}
