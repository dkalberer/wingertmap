import { useEffect, useState } from 'react'
import { Box, Chip, Skeleton, Tooltip, Typography } from '@mui/material'
import type { PlantProtectionStatus } from '../../types'
import { getProtectionStatus } from '../../api/weather'

interface Props {
  vineyardId: string
}

const LEVEL_COLOR: Record<string, string> = {
  grün: '#4caf50',
  gelb: '#ff9800',
  rot: '#f44336',
}

const LEVEL_ICON: Record<string, string> = {
  grün: '🟢',
  gelb: '🟡',
  rot: '🔴',
}

export default function ProtectionBadge({ vineyardId }: Props) {
  const [status, setStatus] = useState<PlantProtectionStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getProtectionStatus(vineyardId)
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false))
  }, [vineyardId])

  if (loading) return <Skeleton variant="rounded" width={180} height={28} />

  if (!status) {
    return (
      <Chip label="Pflanzenschutz: kein Eintrag" size="small" sx={{ bgcolor: 'grey.300', color: 'text.secondary' }} />
    )
  }

  const icon = LEVEL_ICON[status.level] ?? '⚪'
  const color = LEVEL_COLOR[status.level] ?? '#9e9e9e'
  const days = status.daysSinceSpray

  const label = days !== null
    ? `${icon} Pflanzenschutz · vor ${days} Tag${days === 1 ? '' : 'en'}`
    : `${icon} Pflanzenschutz · kein Eintrag`

  const tooltipLines = [
    `Schutzgrad: ~${status.protectionPct} %`,
    status.lastSprayDate ? `Letzte Spritzung: ${status.lastSprayDate}` : 'Keine Spritzung erfasst',
  ]

  return (
    <Tooltip
      title={
        <Box>
          {tooltipLines.map((l) => (
            <Typography key={l} variant="caption" component="p">{l}</Typography>
          ))}
        </Box>
      }
      arrow
    >
      <Chip
        label={label}
        size="small"
        sx={{ bgcolor: color, color: '#fff', fontWeight: 500, cursor: 'default' }}
      />
    </Tooltip>
  )
}
