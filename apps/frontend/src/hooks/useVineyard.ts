import { useState, useEffect, useCallback } from 'react'
import { listVineyards, createVineyard, deleteVineyard } from '../api/vineyards'
import type { Vineyard, GeoJSONPolygon } from '../types'

export function useVineyards() {
  const [vineyards, setVineyards] = useState<Vineyard[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listVineyards()
      setVineyards(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const create = useCallback(async (name: string, description?: string, boundary?: GeoJSONPolygon) => {
    const v = await createVineyard({ name, description, boundary })
    await load()
    return v
  }, [load])

  const remove = useCallback(async (id: string) => {
    await deleteVineyard(id)
    setVineyards((prev) => prev.filter((v) => v.id !== id))
  }, [])

  return { vineyards, loading, error, create, remove, reload: load }
}
