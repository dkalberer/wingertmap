import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DiseaseDetailModal from './DiseaseDetailModal'
import * as protectionApi from '../../api/protection'
import type { DiseaseResult } from '../../types'

vi.mock('../../api/protection')

const mildiou: DiseaseResult = {
  key: 'mildiou',
  name: 'Falscher Mehltau',
  modelId: 7,
  rawIndex: 226,
  rawLevel: 'rot',
  effectiveIndex: 226,
  effectiveLevel: 'rot',
}

describe('DiseaseDetailModal', () => {
  beforeEach(() => vi.resetAllMocks())

  it('does not render when disease is null', () => {
    render(<DiseaseDetailModal vineyardId="v1" disease={null} onClose={() => {}} />)
    expect(screen.queryByText('Falscher Mehltau')).not.toBeInTheDocument()
  })

  it('shows the disease and renders the chart with measures', async () => {
    vi.mocked(protectionApi.getDiseaseSeries).mockResolvedValue({
      vineyardId: 'v1',
      diseaseKey: 'mildiou',
      diseaseName: 'Falscher Mehltau',
      stationId: 138,
      stationName: 'SARGANS',
      from: '2026-05-06',
      to: '2026-05-18',
      points: [
        { date: '2026-05-06', index: 0, level: 'grün' },
        { date: '2026-05-07', index: 120, level: 'gelb' },
        { date: '2026-05-12', index: 220, level: 'rot' },
      ],
      measures: [{ kind: 'spray', at: '2026-05-08T07:00:00Z', label: '4090' }],
    })

    render(<DiseaseDetailModal vineyardId="v1" disease={mildiou} onClose={() => {}} />)
    await waitFor(() => expect(screen.getByText('Falscher Mehltau')).toBeInTheDocument())
    await waitFor(() =>
      expect(screen.getByText(/Modell-Verlauf — Station SARGANS/)).toBeInTheDocument(),
    )
    expect(screen.getByText(/Spritzung · 4090/)).toBeInTheDocument()
  })

  it('shows an alert when the API call fails', async () => {
    vi.mocked(protectionApi.getDiseaseSeries).mockRejectedValue(new Error('boom'))
    render(<DiseaseDetailModal vineyardId="v1" disease={mildiou} onClose={() => {}} />)
    await waitFor(() => expect(screen.getByText(/Zeitreihe nicht verfügbar/)).toBeInTheDocument())
  })
})
