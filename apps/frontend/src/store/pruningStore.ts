import { create } from 'zustand'
import { listPruning, createPruning, updatePruning, deletePruning } from '../api/pruning'
import type { CreatePruningParams, UpdatePruningParams } from '../api/pruning'
import type { PruningRecord } from '../types'

interface PruningState {
  records: PruningRecord[]
  vineyardId: string | null
  loading: boolean
  error: string | null
  load: (vineyardId: string) => Promise<void>
  create: (vineyardId: string, params: CreatePruningParams) => Promise<PruningRecord>
  update: (id: string, params: UpdatePruningParams) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const usePruningStore = create<PruningState>((set) => ({
  records: [],
  vineyardId: null,
  loading: false,
  error: null,

  load: async (vineyardId) => {
    set({ loading: true, error: null, vineyardId })
    try {
      const data = await listPruning(vineyardId)
      set({ records: data })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Fehler beim Laden' })
    } finally {
      set({ loading: false })
    }
  },

  create: async (vineyardId, params) => {
    const record = await createPruning(vineyardId, params)
    set((s) => ({ records: [record, ...s.records] }))
    return record
  },

  update: async (id, params) => {
    const record = await updatePruning(id, params)
    set((s) => ({ records: s.records.map((r) => (r.id === id ? record : r)) }))
  },

  remove: async (id) => {
    await deletePruning(id)
    set((s) => ({ records: s.records.filter((r) => r.id !== id) }))
  },
}))
