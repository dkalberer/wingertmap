import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProtectionPanel from './ProtectionPanel'
import * as protectionApi from '../../api/protection'

vi.mock('../../api/protection')

describe('ProtectionPanel', () => {
  beforeEach(() => vi.resetAllMocks())

  it('renders one card per disease with header info', async () => {
    vi.mocked(protectionApi.getDiseaseRisk).mockResolvedValue({
      vineyardId: 'v1',
      stationId: 138,
      stationName: 'SARGANS',
      fetchedAt: '2026-05-13T12:00:00Z',
      phenology: { rawIndex: 65, label: 'BBCH 60-69 Blüte' },
      diseases: [
        { key: 'mildiou', name: 'Falscher Mehltau', modelId: 7, rawIndex: 226, rawLevel: 'rot', effectiveIndex: 226, effectiveLevel: 'rot' },
        { key: 'oidium', name: 'Echter Mehltau', modelId: 8, rawIndex: 0, rawLevel: 'grün', effectiveIndex: 0, effectiveLevel: 'grün' },
      ],
    })

    render(<ProtectionPanel vineyardId="v1" />)
    await waitFor(() => expect(screen.getByText('Station SARGANS')).toBeInTheDocument())
    expect(screen.getByText(/BBCH 60-69/)).toBeInTheDocument()
    expect(screen.getByText('Falscher Mehltau')).toBeInTheDocument()
    expect(screen.getByText('Echter Mehltau')).toBeInTheDocument()
  })

  it('shows the stale-data alert when psmSyncStale is true', async () => {
    vi.mocked(protectionApi.getDiseaseRisk).mockResolvedValue({
      vineyardId: 'v1',
      stationId: 138,
      stationName: 'SARGANS',
      fetchedAt: '2026-05-13T12:00:00Z',
      diseases: [],
      psmSyncStale: true,
      psmSyncAt: '2026-02-01T00:00:00Z',
    })

    render(<ProtectionPanel vineyardId="v1" />)
    await waitFor(() => expect(screen.getByText(/Datenstand älter als 60 Tage/)).toBeInTheDocument())
  })

  it('shows an alert when the API call fails', async () => {
    vi.mocked(protectionApi.getDiseaseRisk).mockRejectedValue(new Error('boom'))
    render(<ProtectionPanel vineyardId="v1" />)
    await waitFor(() => expect(screen.getByText(/nicht verfügbar/)).toBeInTheDocument())
  })
})
