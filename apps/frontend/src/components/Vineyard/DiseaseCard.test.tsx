import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import DiseaseCard from './DiseaseCard'
import type { DiseaseResult } from '../../types'

function makeDisease(overrides: Partial<DiseaseResult> = {}): DiseaseResult {
  return {
    key: 'mildiou',
    name: 'Falscher Mehltau',
    modelId: 7,
    rawIndex: 0,
    rawLevel: 'grün',
    effectiveIndex: 0,
    effectiveLevel: 'grün',
    ...overrides,
  }
}

describe('DiseaseCard', () => {
  it('renders the disease name and effective level', () => {
    render(<DiseaseCard disease={makeDisease({ effectiveLevel: 'rot' })} />)
    expect(screen.getByText('Falscher Mehltau')).toBeInTheDocument()
    expect(screen.getByText(/rot/i)).toBeInTheDocument()
  })

  it('shows the raw-level hint when effective differs from raw', () => {
    render(
      <DiseaseCard
        disease={makeDisease({
          rawLevel: 'rot',
          rawIndex: 226,
          effectiveLevel: 'grün',
          measureType: 'dispenser',
          lastMeasureAt: '2026-03-15T08:00:00Z',
        })}
      />,
    )
    expect(screen.getByText(/Modell/)).toBeInTheDocument()
    expect(screen.getByText(/Dispenser/)).toBeInTheDocument()
  })

  it('renders the recommendation when present', () => {
    render(
      <DiseaseCard
        disease={makeDisease({ effectiveLevel: 'rot', recommendation: 'Spritzung dringend empfohlen' })}
      />,
    )
    expect(screen.getByText('Spritzung dringend empfohlen')).toBeInTheDocument()
  })
})
