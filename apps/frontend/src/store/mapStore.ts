import { create } from 'zustand'
import type { Vineyard, Vine } from '../types'

export type DrawingMode = 'none' | 'polygon' | 'linestring' | 'point'

interface MapState {
  center: [number, number]
  zoom: number
  selectedVineyard: Vineyard | null
  selectedVine: Vine | null
  drawingMode: DrawingMode
  setCenter: (center: [number, number]) => void
  setZoom: (zoom: number) => void
  selectVineyard: (v: Vineyard | null) => void
  selectVine: (v: Vine | null) => void
  setDrawingMode: (mode: DrawingMode) => void
}

export const useMapStore = create<MapState>((set) => ({
  center: [47.5, 7.6], // Default: Basler Weinbaugebiet
  zoom: 14,
  selectedVineyard: null,
  selectedVine: null,
  drawingMode: 'none',

  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),
  selectVineyard: (selectedVineyard) => set({ selectedVineyard }),
  selectVine: (selectedVine) => set({ selectedVine }),
  setDrawingMode: (drawingMode) => set({ drawingMode }),
}))
