import { describe, it, expect, beforeEach } from 'vitest'
import { useMapStore } from './mapStore'

describe('mapStore', () => {
  beforeEach(() => {
    useMapStore.setState({
      center: [47.5, 7.6],
      zoom: 14,
      selectedVineyard: null,
      drawingMode: 'none',
    })
  })

  it('setCenter updates center', () => {
    useMapStore.getState().setCenter([47.6, 7.7])
    expect(useMapStore.getState().center).toEqual([47.6, 7.7])
  })

  it('setDrawingMode transitions correctly', () => {
    useMapStore.getState().setDrawingMode('polygon')
    expect(useMapStore.getState().drawingMode).toBe('polygon')
    useMapStore.getState().setDrawingMode('none')
    expect(useMapStore.getState().drawingMode).toBe('none')
  })

  it('selectVineyard sets selected vineyard', () => {
    const vineyard = {
      id: 'v1', name: 'Test', createdAt: '', description: '',
    }
    useMapStore.getState().selectVineyard(vineyard as any)
    expect(useMapStore.getState().selectedVineyard?.id).toBe('v1')
  })
})
