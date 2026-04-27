import { create } from 'zustand'
import { listVarieties, createVariety, deleteVariety } from '../api/varieties'
import type { GrapeVariety, GrapeColor } from '../types'

interface VarietyState {
  varieties: GrapeVariety[]
  loading: boolean
  error: string | null
  load: () => Promise<void>
  create: (name: string, color: GrapeColor) => Promise<GrapeVariety>
  remove: (id: string) => Promise<void>
}

export const useVarietyStore = create<VarietyState>((set) => ({
  varieties: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const data = await listVarieties()
      set({ varieties: data })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Fehler beim Laden' })
    } finally {
      set({ loading: false })
    }
  },

  create: async (name, color) => {
    const v = await createVariety(name, color)
    set((s) => ({ varieties: [...s.varieties, v].sort((a, b) => a.name.localeCompare(b.name)) }))
    return v
  },

  remove: async (id) => {
    await deleteVariety(id)
    set((s) => ({ varieties: s.varieties.filter((v) => v.id !== id) }))
  },
}))
