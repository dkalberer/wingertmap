import { useEffect, useState } from 'react'
import { Alert, Box, Skeleton, Typography } from '@mui/material'
import WbSunnyOutlinedIcon from '@mui/icons-material/WbSunnyOutlined'
import type { DiseaseResult, DiseaseRiskResponse } from '../../types'
import { getDiseaseRisk } from '../../api/protection'
import DiseaseCard from './DiseaseCard'
import DiseaseDetailModal from './DiseaseDetailModal'

interface Props {
  vineyardId: string
}

export default function ProtectionPanel({ vineyardId }: Props) {
  const [data, setData] = useState<DiseaseRiskResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState<DiseaseResult | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    getDiseaseRisk(vineyardId)
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [vineyardId])

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={240} />
        <Box
          sx={{
            mt: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 1,
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={70} />
          ))}
        </Box>
      </Box>
    )
  }

  if (error || !data) {
    return <Alert severity="warning">Pflanzenschutz-Daten nicht verfügbar.</Alert>
  }

  const diseases = data.diseases ?? []

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap', mb: 1 }}>
        <Typography variant="overline" color="text.secondary">
          Pflanzenschutz
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Station {data.stationName}
        </Typography>
        {data.phenology && (
          <Typography variant="caption" color="text.secondary">
            · {data.phenology.label}
          </Typography>
        )}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 1,
        }}
      >
        {diseases.map((d) => (
          <DiseaseCard key={d.key} disease={d} onClick={() => setSelected(d)} />
        ))}
      </Box>

      {data.sprayWindow && (
        <Alert
          severity="success"
          icon={<WbSunnyOutlinedIcon fontSize="inherit" />}
          sx={{ mt: 1.5 }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Nächstes Spritzfenster
          </Typography>
          <Typography variant="body2">
            {new Date(data.sprayWindow.start).toLocaleString('de-CH', {
              weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
            })}
            {' – '}
            {new Date(data.sprayWindow.end).toLocaleString('de-CH', {
              hour: '2-digit', minute: '2-digit',
            })}
            {` (${data.sprayWindow.hoursDry} h trocken · ${data.sprayWindow.source})`}
          </Typography>
          {(data.sprayWindow.avgTempC != null || data.sprayWindow.avgLeafWetPct != null) && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
              {data.sprayWindow.avgTempC != null && (
                <>Ø {data.sprayWindow.avgTempC.toFixed(1)} °C
                {data.sprayWindow.minTempC != null && data.sprayWindow.maxTempC != null &&
                  ` (${data.sprayWindow.minTempC.toFixed(0)}–${data.sprayWindow.maxTempC.toFixed(0)})`}
                </>
              )}
              {data.sprayWindow.avgTempC != null && data.sprayWindow.avgLeafWetPct != null && ' · '}
              {data.sprayWindow.avgLeafWetPct != null && (
                <>Ø Blattnässe {data.sprayWindow.avgLeafWetPct.toFixed(0)} %</>
              )}
              {' · 0 mm Regen'}
            </Typography>
          )}
          {data.sprayWindow.hints?.map((h) => (
            <Typography key={h} variant="caption" sx={{ display: 'block', mt: 0.5, fontStyle: 'italic' }}>
              💡 {h}
            </Typography>
          ))}
        </Alert>
      )}

      {data.psmSyncStale && (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          PSM-Datenstand älter als 60 Tage
          {data.psmSyncAt && ` (zuletzt aktualisiert ${new Date(data.psmSyncAt).toLocaleDateString('de-CH')})`}.
        </Alert>
      )}

      <DiseaseDetailModal
        vineyardId={vineyardId}
        disease={selected}
        onClose={() => setSelected(null)}
      />
    </Box>
  )
}
