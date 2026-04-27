import { useState, useEffect, useCallback } from 'react'
import { listVines, createVine, nearbyVines } from '../api/vines'
import type { Vine, GeoJSONPoint } from '../types'

export function useVines(rowId: string) {
  const [vines, setVines] = useState<Vine[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!rowId) return
    setLoading(true)
    try {
      const data = await listVines(rowId)
      setVines(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [rowId])

  useEffect(() => { load() }, [load])

  const create = useCallback(async (vineNumber: number, position?: GeoJSONPoint, notes?: string) => {
    const v = await createVine(rowId, { vineNumber, position, notes })
    setVines((prev) => [...prev, v])
    return v
  }, [rowId])

  return { vines, loading, error, create, reload: load }
}

export function useNearbyVines(lat: number, lng: number, radius: number) {
  const [vines, setVines] = useState<Vine[]>([])
  const [loading, setLoading] = useState(false)

  const search = useCallback(async () => {
    if (!lat || !lng) return
    setLoading(true)
    try {
      const data = await nearbyVines(lat, lng, radius)
      setVines(data)
    } finally {
      setLoading(false)
    }
  }, [lat, lng, radius])

  useEffect(() => { search() }, [search])

  return { vines, loading, search }
}
