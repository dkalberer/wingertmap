import React from 'react'
import { Box, Card, CardContent, Chip, Tooltip, Typography } from '@mui/material'
import type { DiseaseResult } from '../../types'

interface Props {
  disease: DiseaseResult
  onClick?: () => void
}

const LEVEL_CHIP_COLOR = { grün: 'success', gelb: 'warning', rot: 'error' } as const
const LEVEL_ICON: Record<string, string> = { grün: '🟢', gelb: '🟡', rot: '🔴' }

const MEASURE_LABEL: Record<string, string> = {
  spray: 'Spritzschutz',
  dispenser: 'Pheromon-Dispenser',
  'mowing-pause': 'Mahd-Pause',
}

function formatIndex(d: DiseaseResult): string {
  const value = d.rawIndex
  const formatted = value >= 100 ? value.toFixed(0) : value.toFixed(1)
  return d.indexUnit ? `${formatted} ${d.indexUnit}` : formatted
}

function renderTrend(delta: number): React.ReactNode {
  const abs = Math.abs(delta)
  if (abs < 0.5) return <span>→ stabil</span>
  if (delta > 0) return <span style={{ color: '#d32f2f' }}>↑ steigend (+{delta.toFixed(0)})</span>
  return <span style={{ color: '#2e7d32' }}>↓ fallend ({delta.toFixed(0)})</span>
}

export default function DiseaseCard({ disease, onClick }: Props) {
  const effective = disease.effectiveLevel || 'grün'
  const chipColor = LEVEL_CHIP_COLOR[effective as keyof typeof LEVEL_CHIP_COLOR] ?? 'default'
  const icon = LEVEL_ICON[effective] ?? '⚪'
  const isModified = disease.rawLevel !== disease.effectiveLevel
  const measureLabel = disease.measureType ? MEASURE_LABEL[disease.measureType] : null

  const indexTooltip = (
    <Box sx={{ maxWidth: 260 }}>
      <Typography variant="caption" component="p" sx={{ fontWeight: 600 }}>
        Aktueller Wert: {formatIndex(disease)}
      </Typography>
    </Box>
  )

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 120ms ease',
        '&:hover': onClick ? { boxShadow: 2 } : undefined,
      }}
      onClick={onClick}
    >
      <CardContent
        sx={{
          p: 1.25,
          '&:last-child': { pb: 1.25 },
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.25,
        }}
      >
        <Tooltip title={indexTooltip} arrow placement="top">
          <Chip
            label={`${icon} ${effective}`}
            size="small"
            color={chipColor}
            sx={{ fontWeight: 600, flexShrink: 0 }}
          />
        </Tooltip>

        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.25 }}>
              {disease.name}
            </Typography>
          </Box>

          {(disease.indexLabel || disease.indexDelta != null) && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, lineHeight: 1.25 }}>
              {disease.indexLabel && <span>{disease.indexLabel}</span>}
              {disease.indexLabel && disease.indexDelta != null && <span>·</span>}
              {disease.indexDelta != null && renderTrend(disease.indexDelta)}
            </Typography>
          )}

          {isModified && (
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>
              Modell {LEVEL_ICON[disease.rawLevel] ?? '⚪'} {disease.rawLevel}
              {measureLabel ? ` · gemildert durch ${measureLabel}` : ''}
            </Typography>
          )}

          {!isModified && measureLabel && (
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>
              {measureLabel}
              {disease.lastMeasureAt &&
                ` · seit ${new Date(disease.lastMeasureAt).toLocaleDateString('de-CH')}`}
            </Typography>
          )}

          {disease.protectionDaysRemaining != null && disease.protectionDaysTotal != null && disease.protectionDaysTotal > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 95, fontSize: '0.7rem' }}>
                Schutz: {disease.protectionDaysRemaining.toFixed(0)} / {disease.protectionDaysTotal.toFixed(0)} Tage
              </Typography>
              <Box sx={{ flex: 1, height: 4, bgcolor: 'action.hover', borderRadius: 2, overflow: 'hidden' }}>
                <Box sx={{
                  height: '100%',
                  width: `${Math.min(100, (disease.protectionDaysRemaining / disease.protectionDaysTotal) * 100)}%`,
                  bgcolor: disease.protectionDaysRemaining > 3 ? 'success.main' : 'warning.main',
                }} />
              </Box>
            </Box>
          )}

          {disease.recommendation && (
            <Typography variant="body2" sx={{ fontSize: '0.8rem', lineHeight: 1.35, color: 'text.primary' }}>
              {disease.recommendation}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}
