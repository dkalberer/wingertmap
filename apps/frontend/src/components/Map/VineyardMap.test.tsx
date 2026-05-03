import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('react-map-gl/maplibre', () => ({
  default: ({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) => (
    <div data-testid="map-container" style={style}>{children}</div>
  ),
  Map: ({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) => (
    <div data-testid="map-container" style={style}>{children}</div>
  ),
  Source: () => null,
  Layer: () => null,
  Marker: () => null,
  useMap: () => ({ current: null }),
  useControl: () => ({
    add: vi.fn(), deleteAll: vi.fn(), getAll: vi.fn(() => ({ features: [] })),
    changeMode: vi.fn(),
  }),
}))
vi.mock('maplibre-gl-draw', () => ({ default: vi.fn().mockImplementation(() => ({})) }))
vi.mock('maplibre-gl-draw/dist/mapbox-gl-draw.css', () => ({}))
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

import VineyardMap from './VineyardMap'

describe('VineyardMap', () => {
  it('renders map container', () => {
    render(<VineyardMap />)
    expect(screen.getByTestId('vineyard-map')).toBeInTheDocument()
  })

  it('renders map controls', () => {
    render(<VineyardMap />)
    expect(screen.getByRole('button', { name: /gps/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /kartenebene/i })).toBeInTheDocument()
  })
})
