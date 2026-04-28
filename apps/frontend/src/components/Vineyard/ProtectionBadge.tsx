import { useEffect, useState } from 'react'
import { Box, Chip, Skeleton, Tooltip, Typography } from '@mui/material'
import type { PlantProtectionStatus } from '../../types'
import { getProtectionStatus } from '../../api/weather'

interface Props {
  vineyardId: string
}

// Map protection level to MUI color prop — uses theme palette instead of hardcoded hex
const LEVEL_CHIP_COLOR = {
  grün: 'success',
  gelb: 'warning',
  rot:  'error',
} as const

const LEVEL_ICON: Record<string, string> = {
  grün: '🟢',
  gelb: '🟡',
  rot:  '🔴',
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
      <Chip
        label="Pflanzenschutz: kein Eintrag"
        size="small"
        sx={{ bgcolor: 'action.hover', color: 'text.secondary' }}
      />
    )
  }

  const icon = LEVEL_ICON[status.level] ?? '⚪'
  const chipColor = LEVEL_CHIP_COLOR[status.level as keyof typeof LEVEL_CHIP_COLOR] ?? 'default'
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
        color={chipColor}
        variant="filled"
        sx={{ fontWeight: 500, cursor: 'default' }}
      />
    </Tooltip>
  )
}
