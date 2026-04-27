import { create } from 'zustand'
import { listVineyards, createVineyard, deleteVineyard } from '../api/vineyards'
import type { Vineyard, GeoJSONPolygon } from '../types'

interface VineyardState {
  vineyards: Vineyard[]
  loading: boolean
  error: string | null
  load: () => Promise<void>
  create: (name: string, description?: string, boundary?: GeoJSONPolygon) => Promise<Vineyard>
  remove: (id: string) => Promise<void>
}

export const useVineyardStore = create<VineyardState>((set, get) => ({
  vineyards: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const data = await listVineyards()
      set({ vineyards: data })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Fehler beim Laden' })
    } finally {
      set({ loading: false })
    }
  },

  create: async (name, description, boundary) => {
    const v = await createVineyard({ name, description, boundary })
    await get().load()
    return v
  },

  remove: async (id) => {
    await deleteVineyard(id)
    set((s) => ({ vineyards: s.vineyards.filter((v) => v.id !== id) }))
  },
}))
