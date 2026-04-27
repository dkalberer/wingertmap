import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import VineyardList from './VineyardList'

describe('VineyardList', () => {
  it('renders vineyard names from API', async () => {
    render(<VineyardList onSelect={() => {}} />)
    await waitFor(() => expect(screen.getByText('Testberg')).toBeInTheDocument())
  })

  it('shows loading state initially', () => {
    render(<VineyardList onSelect={() => {}} />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })
})
