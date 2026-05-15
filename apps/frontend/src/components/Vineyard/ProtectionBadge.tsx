import { useEffect, useState } from 'react'
import { Box, Chip, Skeleton, Tooltip, Typography } from '@mui/material'
import type { DiseaseRiskResponse } from '../../types'
import { getDiseaseRisk } from '../../api/protection'

interface Props {
  vineyardId: string
}

const LEVEL_CHIP_COLOR = {
  grün: 'success',
  gelb: 'warning',
  rot: 'error',
} as const

const LEVEL_ICON: Record<string, string> = {
  grün: '🟢',
  gelb: '🟡',
  rot: '🔴',
}

const AGGREGATE_KEYS = new Set(['mildiou', 'oidium', 'black-rot', 'botrytis', 'acariose'])

export default function ProtectionBadge({ vineyardId }: Props) {
  const [data, setData] = useState<DiseaseRiskResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDiseaseRisk(vineyardId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [vineyardId])

  if (loading) return <Skeleton variant="rounded" width={180} height={28} />

  if (!data) {
    return (
      <Chip
        label="Pflanzenschutz: kein Eintrag"
        size="small"
        sx={{ bgcolor: 'action.hover', color: 'text.secondary' }}
      />
    )
  }

  const relevant = data.diseases.filter((d) => AGGREGATE_KEYS.has(d.key))
  const rank: Record<string, number> = { rot: 0, gelb: 1, grün: 2, '': 3 }
  const worst = [...relevant].sort((a, b) => rank[a.effectiveLevel] - rank[b.effectiveLevel])[0]
  const level = worst?.effectiveLevel || 'grün'
  const icon = LEVEL_ICON[level] ?? '⚪'
  const chipColor = LEVEL_CHIP_COLOR[level as keyof typeof LEVEL_CHIP_COLOR] ?? 'default'

  return (
    <Tooltip
      arrow
      title={
        <Box>
          <Typography variant="caption" component="p">
            Station: {data.stationName}
          </Typography>
          {relevant.map((d) => (
            <Typography key={d.key} variant="caption" component="p">
              {LEVEL_ICON[d.effectiveLevel] ?? '⚪'} {d.name}
            </Typography>
          ))}
        </Box>
      }
    >
      <Chip
        label={`${icon} Pflanzenschutz`}
        size="small"
        color={chipColor}
        sx={{ fontWeight: 500, cursor: 'default' }}
      />
    </Tooltip>
  )
}
