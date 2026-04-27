import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Polygon: () => null,
  CircleMarker: () => null,
  Popup: () => null,
  Tooltip: () => null,
  useMap: () => ({ flyTo: vi.fn(), on: vi.fn(), off: vi.fn(), addLayer: vi.fn(), removeLayer: vi.fn() }),
}))
vi.mock('leaflet-draw', () => ({}))
vi.mock('leaflet-draw/dist/leaflet.draw.css', () => ({}))
vi.mock('leaflet/dist/leaflet.css', () => ({}))

import VineyardMap from './VineyardMap'

describe('VineyardMap', () => {
  it('renders map container', () => {
    render(<VineyardMap />)
    expect(screen.getByTestId('vineyard-map')).toBeInTheDocument()
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })

  it('renders Swisstopo tile layer', () => {
    render(<VineyardMap />)
    expect(screen.getByTestId('tile-layer')).toBeInTheDocument()
  })

  it('renders drawing tool buttons', () => {
    render(<VineyardMap />)
    expect(screen.getByRole('button', { name: /wingert zeichnen/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reihe zeichnen/i })).toBeInTheDocument()
  })
})
