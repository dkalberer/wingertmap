import { useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, SwipeableDrawer,
  Box, Typography, useMediaQuery, useTheme, IconButton,
  Chip, CircularProgress, Button,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import GpsFixedIcon from '@mui/icons-material/GpsFixed'
import AddLocationAltIcon from '@mui/icons-material/AddLocationAlt'
import PlaceIcon from '@mui/icons-material/Place'
import ClearIcon from '@mui/icons-material/Clear'
import type { GeoJSONPoint, Task } from '../../types'
import type { CreateTaskParams } from '../../api/tasks'
import TaskForm from './TaskForm'

interface Props {
  open: boolean
  pendingLocation: GeoJSONPoint | null
  vineyardId?: string
  onStartPicking?: () => void
  onSubmit: (params: CreateTaskParams) => Promise<Task>
  onClose: () => void
}

function useGPSPicker() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function pick(onSuccess: (p: GeoJSONPoint) => void) {
    setError(null)
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false)
        onSuccess({ type: 'Point', coordinates: [pos.coords.longitude, pos.coords.latitude] })
      },
      (err) => { setLoading(false); setError(err.message) },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return { loading, error, pick }
}

export default function CreateTaskDialog({ open, pendingLocation, vineyardId, onStartPicking, onSubmit, onClose }: Props) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [internalLocation, setInternalLocation] = useState<GeoJSONPoint | null>(null)
  const gps = useGPSPicker()

  // Use external pendingLocation first, fall back to internally picked GPS
  const location = pendingLocation ?? internalLocation

  function handleGPSPick() {
    gps.pick(setInternalLocation)
  }

  function handleClose() {
    setInternalLocation(null)
    onClose()
  }

  const locationBar = (
    <Box sx={{ mb: 1.5 }}>
      {location ? (
        <Chip
          icon={<PlaceIcon />}
          label={`${location.coordinates[1].toFixed(5)}, ${location.coordinates[0].toFixed(5)}`}
          size="small"
          onDelete={() => setInternalLocation(null)}
          deleteIcon={<ClearIcon />}
          color="primary"
          variant="outlined"
        />
      ) : isMobile ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={gps.loading ? <CircularProgress size={14} /> : <GpsFixedIcon />}
            onClick={handleGPSPick}
            disabled={gps.loading}
            fullWidth
            sx={{ minHeight: 44 }}
          >
            {gps.loading ? 'GPS…' : 'GPS-Standort verwenden'}
          </Button>
          {onStartPicking && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddLocationAltIcon />}
              onClick={() => { setInternalLocation(null); onStartPicking() }}
              fullWidth
              sx={{ minHeight: 44 }}
            >
              Auf Karte wählen
            </Button>
          )}
        </Box>
      ) : (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            icon={gps.loading ? <CircularProgress size={14} /> : <GpsFixedIcon />}
            label={gps.loading ? 'GPS…' : 'GPS'}
            size="small"
            onClick={handleGPSPick}
            disabled={gps.loading}
            variant="outlined"
          />
          {onStartPicking && (
            <Chip
              icon={<AddLocationAltIcon />}
              label="Auf Karte wählen"
              size="small"
              onClick={() => { setInternalLocation(null); onStartPicking() }}
              variant="outlined"
            />
          )}
        </Box>
      )}
      {gps.error && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
          {gps.error}
        </Typography>
      )}
    </Box>
  )

  const title = (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Neue Aufgabe</Typography>
      <IconButton size="small" onClick={handleClose} sx={{ minWidth: 44, minHeight: 44 }}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  )

  const body = (
    <Box sx={{ pt: 1 }}>
      {locationBar}
      <TaskForm
        location={location ?? undefined}
        vineyardId={vineyardId}
        onSubmit={onSubmit}
        onCancel={handleClose}
      />
    </Box>
  )

  if (isMobile) {
    return (
      <SwipeableDrawer
        anchor="bottom"
        open={open}
        onOpen={() => {}}
        onClose={handleClose}
        disableSwipeToOpen
        sx={{
          '& .MuiDrawer-paper': {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            px: 2,
            pb: 3,
            pt: 1.5,
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
          <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'divider' }} />
        </Box>
        {title}
        {body}
      </SwipeableDrawer>
    )
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 0 }}>{title}</DialogTitle>
      <DialogContent>{body}</DialogContent>
    </Dialog>
  )
}
