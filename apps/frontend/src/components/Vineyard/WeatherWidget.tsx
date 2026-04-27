import { useEffect, useState } from 'react'
import { Box, Skeleton, Typography } from '@mui/material'
import type { WeatherData } from '../../types'
import { getWeather } from '../../api/weather'

interface Props {
  vineyardId: string
}

export default function WeatherWidget({ vineyardId }: Props) {
  const [data, setData] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    getWeather(vineyardId)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [vineyardId])

  if (loading) {
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={40} />)}
      </Box>
    )
  }

  if (error || !data) {
    return (
      <Typography variant="body2" color="text.disabled">
        Keine Wetterdaten verfügbar
      </Typography>
    )
  }

  const items = [
    { icon: '🌡', label: `${data.tempC.toFixed(1)} °C` },
    { icon: '💧', label: `${data.humidityPct.toFixed(0)} %` },
    { icon: '🌧', label: `${data.precipMm.toFixed(1)} mm` },
    { icon: '🌿', label: `${data.leafWetH.toFixed(1)} h` },
  ]

  return (
    <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        {items.map(({ icon, label }) => (
          <Box
            key={icon}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              bgcolor: 'action.hover',
              borderRadius: 1,
              px: 1.5,
              py: 0.75,
            }}
          >
            <span style={{ fontSize: '1rem' }}>{icon}</span>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>{label}</Typography>
          </Box>
        ))}
      </Box>
      <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }} component="p">
        Station: {data.stationName}
      </Typography>
    </Box>
  )
}
