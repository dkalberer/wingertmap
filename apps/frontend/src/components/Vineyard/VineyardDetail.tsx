import { Box, Divider, Typography } from '@mui/material'
import type { Vineyard } from '../../types'
import WeatherWidget from './WeatherWidget'
import ProtectionBadge from './ProtectionBadge'
import JournalSection from './JournalSection'

interface Props {
  vineyard: Vineyard
}

export default function VineyardDetail({ vineyard }: Props) {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6">{vineyard.name}</Typography>
      {vineyard.description && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {vineyard.description}
        </Typography>
      )}

      <Box sx={{ mt: 1.5 }}>
        <ProtectionBadge vineyardId={vineyard.id} />
      </Box>

      <Divider sx={{ my: 2 }} />

      <Typography variant="overline" color="text.secondary" component="p" sx={{ mb: 1 }}>
        Wetter (letzte 24h)
      </Typography>
      <WeatherWidget vineyardId={vineyard.id} />

      <Divider sx={{ my: 2 }} />

      <JournalSection vineyardId={vineyard.id} />
    </Box>
  )
}
