import { useEffect, useState } from 'react'
import {
  Alert, Box, Chip, CircularProgress, Dialog, DialogContent, DialogTitle,
  IconButton, Link, List, ListItem, ListItemText, Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from 'recharts'
import type { DiseaseResult, DiseaseSeriesResponse } from '../../types'
import { getDiseaseSeries } from '../../api/protection'

interface Props {
  vineyardId: string
  disease: DiseaseResult | null
  onClose: () => void
}

function PdfReportInline({ href }: { href: string }) {
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)
  return (
    <Box sx={{ mb: 1 }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Link component="button" variant="caption" onClick={() => setOpen((v) => !v)}>
          📄 Detailbericht inkl. Biologie-Kurve {open ? 'einklappen' : 'einblenden'}
        </Link>
        <Link href={href} target="_blank" rel="noopener noreferrer" variant="caption">
          (oder in neuem Tab öffnen)
        </Link>
      </Box>
      {open && !failed && (
        <Box sx={{ mt: 1, border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
          <iframe
            src={href}
            title="Agrometeo Detailbericht"
            style={{ width: '100%', height: 600, border: 'none' }}
            onError={() => setFailed(true)}
          />
        </Box>
      )}
      {failed && (
        <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
          Inline-Darstellung von agrometeo.ch blockiert. Bitte über den Link in neuem Tab öffnen.
        </Typography>
      )}
    </Box>
  )
}

export default function DiseaseDetailModal({ vineyardId, disease, onClose }: Props) {
  const [data, setData] = useState<DiseaseSeriesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!disease) {
      setData(null)
      return
    }
    let cancelled = false
    const today = new Date()
    const from = new Date(today)
    from.setDate(today.getDate() - 7)
    const to = new Date(today)
    to.setDate(today.getDate() + 5)
    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    setLoading(true)
    setError(false)
    getDiseaseSeries(vineyardId, disease.key, fmt(from), fmt(to))
      .then((r) => { if (!cancelled) setData(r) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [vineyardId, disease])

  if (!disease) return null

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{disease.name}</span>
        <IconButton onClick={onClose} size="small" aria-label="Schliessen">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip label={`Effektiv: ${disease.effectiveLevel}`} size="small" />
          {disease.rawLevel !== disease.effectiveLevel && (
            <Chip label={`Modell: ${disease.rawLevel}`} size="small" variant="outlined" />
          )}
          {disease.recommendation && (
            <Typography variant="caption" color="text.secondary">
              {disease.recommendation}
            </Typography>
          )}
        </Box>
        {(disease.key === 'mildiou' || disease.key === 'oidium') && data && (
          <PdfReportInline
            href={`https://api.agrometeo.ch/${disease.key}/stations/${data.stationId}/report`}
          />
        )}

        {disease.indexHelp && (
          <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1, mb: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
              Was bedeutet der Wert?
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mt: 0.25 }}>
              {disease.indexHelp}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Aktueller Wert: <strong>{disease.rawIndex.toFixed(disease.rawIndex >= 100 ? 0 : 1)}{disease.indexUnit ? ' ' + disease.indexUnit : ''}</strong>
              {disease.indexDelta != null && Math.abs(disease.indexDelta) >= 0.5 && (
                <> · gegenüber gestern: {disease.indexDelta > 0 ? '+' : ''}{disease.indexDelta.toFixed(disease.indexDelta >= 100 || disease.indexDelta <= -100 ? 0 : 1)}</>
              )}
              {disease.indexDelta != null && Math.abs(disease.indexDelta) < 0.5 && <> · unverändert</>}
              {disease.indexLabel && <> · {disease.indexLabel}</>}
            </Typography>
            {disease.recentMaxIndex != null && disease.recentMaxAt && (
              <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
                ⚠ Infektions-Peak vor {Math.round((Date.now() - new Date(disease.recentMaxAt).getTime()) / 86400000)} Tagen:
                Index {disease.recentMaxIndex.toFixed(0)} · noch in Inkubation
                {disease.incubationDays ? ` (bis ca. ${Math.max(0, disease.incubationDays - Math.round((Date.now() - new Date(disease.recentMaxAt).getTime()) / 86400000))} Tage)` : ''}
              </Typography>
            )}
          </Box>
        )}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        )}
        {error && <Alert severity="warning">Zeitreihe nicht verfügbar.</Alert>}

        {data && (
          <>
            <Typography variant="overline" color="text.secondary">
              Modell-Verlauf — Station {data.stationName}
            </Typography>
            <Box sx={{ width: '100%', height: 220, mb: 2 }}>
              <ResponsiveContainer>
                <LineChart data={data.points ?? []} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                  <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} fontSize={11} />
                  <YAxis fontSize={11} />
                  <RTooltip />
                  <Line type="monotone" dataKey="index" stroke="#7e57c2" dot={false} strokeWidth={2} />
                  {(data.measures ?? []).map((m) => {
                    const day = m.at.slice(0, 10)
                    const pt = (data.points ?? []).find((p) => p.date === day)
                    if (!pt) return null
                    return <ReferenceDot key={m.at} x={day} y={pt.index} r={5} fill="#1976d2" stroke="#fff" />
                  })}
                </LineChart>
              </ResponsiveContainer>
            </Box>

            <Typography variant="overline" color="text.secondary">Eigene Massnahmen</Typography>
            {(data.measures ?? []).length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                Keine Massnahmen im Zeitraum erfasst.
              </Typography>
            ) : (
              <List dense>
                {(data.measures ?? []).map((m) => (
                  <ListItem key={m.at} disablePadding>
                    <ListItemText
                      primary={`${m.kind === 'spray' ? 'Spritzung' : m.kind}${m.label ? ' · ' + m.label : ''}`}
                      secondary={new Date(m.at).toLocaleString('de-CH')}
                    />
                  </ListItem>
                ))}
              </List>
            )}

            {data.weather && data.weather.length > 0 && (disease.incubationDays ?? 0) > 0 && (
              <>
                <Typography variant="overline" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
                  Wetter (Tagesmittel)
                </Typography>
                <Box sx={{ width: '100%', height: 200, mb: 2 }}>
                  <ResponsiveContainer>
                    <ComposedChart data={data.weather} margin={{ top: 8, right: 0, bottom: 0, left: -10 }}>
                      <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} fontSize={11} />
                      <YAxis yAxisId="left" fontSize={11} />
                      <YAxis yAxisId="right" orientation="right" fontSize={11} />
                      <RTooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar yAxisId="right" dataKey="precipMm" fill="#90caf9" name="Niederschlag (mm)" />
                      <Line yAxisId="left" type="monotone" dataKey="avgTempC" stroke="#e53935" name="Ø Temp (°C)" dot={false} strokeWidth={2} />
                      <Line yAxisId="left" type="monotone" dataKey="avgLeafWetPct" stroke="#43a047" name="Ø Blattnässe (%)" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Box>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
