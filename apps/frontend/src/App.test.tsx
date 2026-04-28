import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('./components/Map/VineyardMap', () => ({
  default: () => <div data-testid="vineyard-map" />,
}))
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

import App from './App'

describe('App', () => {
  it('rendert Login-Seite wenn nicht eingeloggt', () => {
    render(<App />)
    expect(screen.getByText('Wingertmap')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /anmelden/i })).toBeInTheDocument()
  })
})
