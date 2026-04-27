import { create } from 'zustand'
import { listHarvests, createHarvest, updateHarvest, deleteHarvest } from '../api/harvests'
import type { CreateHarvestParams } from '../api/harvests'
import type { Harvest } from '../types'

interface HarvestState {
  harvests: Harvest[]
  vineyardId: string | null
  loading: boolean
  error: string | null
  load: (vineyardId: string) => Promise<void>
  create: (vineyardId: string, params: CreateHarvestParams) => Promise<Harvest>
  update: (id: string, params: CreateHarvestParams) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useHarvestStore = create<HarvestState>((set) => ({
  harvests: [],
  vineyardId: null,
  loading: false,
  error: null,

  load: async (vineyardId) => {
    set({ loading: true, error: null, vineyardId })
    try {
      const data = await listHarvests(vineyardId)
      set({ harvests: data })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Fehler beim Laden' })
    } finally {
      set({ loading: false })
    }
  },

  create: async (vineyardId, params) => {
    const h = await createHarvest(vineyardId, params)
    set((s) => ({ harvests: [h, ...s.harvests] }))
    return h
  },

  update: async (id, params) => {
    const h = await updateHarvest(id, params)
    set((s) => ({ harvests: s.harvests.map((x) => (x.id === id ? h : x)) }))
  },

  remove: async (id) => {
    await deleteHarvest(id)
    set((s) => ({ harvests: s.harvests.filter((h) => h.id !== id) }))
  },
}))
