import { create } from 'zustand'
import { listJournals, upsertJournal } from '../api/journals'
import type { VintageJournal } from '../types'

interface JournalState {
  journals: VintageJournal[]
  vineyardId: string | null
  loading: boolean
  saving: boolean
  error: string | null
  load: (vineyardId: string) => Promise<void>
  save: (vineyardId: string, year: number, notes: string) => Promise<void>
}

export const useJournalStore = create<JournalState>((set) => ({
  journals: [],
  vineyardId: null,
  loading: false,
  saving: false,
  error: null,

  load: async (vineyardId) => {
    set({ loading: true, error: null, vineyardId })
    try {
      const data = await listJournals(vineyardId)
      set({ journals: data })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Fehler beim Laden' })
    } finally {
      set({ loading: false })
    }
  },

  save: async (vineyardId, year, notes) => {
    set({ saving: true, error: null })
    try {
      const updated = await upsertJournal(vineyardId, year, notes)
      set((s) => {
        const exists = s.journals.some((j) => j.year === year)
        const journals = exists
          ? s.journals.map((j) => (j.year === year ? updated : j))
          : [updated, ...s.journals].sort((a, b) => b.year - a.year)
        return { journals }
      })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Fehler beim Speichern' })
    } finally {
      set({ saving: false })
    }
  },
}))
