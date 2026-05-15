import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import SprayFields from './SprayFields'

vi.mock('../../api/psm')

describe('SprayFields', () => {
  it('renders the product picker label', () => {
    render(<SprayFields value={{ productIds: [], substanceIds: [] }} onChange={vi.fn()} />)
    expect(screen.getByLabelText(/Produkt/i)).toBeInTheDocument()
  })

  it('renders the dosage field', () => {
    render(<SprayFields value={{ productIds: [], substanceIds: [] }} onChange={vi.fn()} />)
    expect(screen.getByLabelText(/Dosierung/i)).toBeInTheDocument()
  })
})
