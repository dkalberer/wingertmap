import {
  Dialog, DialogTitle, DialogContent, SwipeableDrawer,
  Box, Typography, useMediaQuery, useTheme, IconButton,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import type { GeoJSONPoint, Task } from '../../types'
import type { CreateTaskParams } from '../../api/tasks'
import TaskForm from './TaskForm'

interface Props {
  open: boolean
  pendingLocation: GeoJSONPoint | null
  vineyardId?: string
  onSubmit: (params: CreateTaskParams) => Promise<Task>
  onClose: () => void
}

function LocationHint({ location }: { location: GeoJSONPoint | null }) {
  if (!location) return null
  const [lng, lat] = location.coordinates
  return (
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
      📍 {lat.toFixed(5)}, {lng.toFixed(5)}
    </Typography>
  )
}

export default function CreateTaskDialog({ open, pendingLocation, vineyardId, onSubmit, onClose }: Props) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const title = (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Neue Aufgabe</Typography>
      <IconButton size="small" onClick={onClose} sx={{ minWidth: 44, minHeight: 44 }}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  )

  const body = (
    <Box sx={{ pt: 1 }}>
      <LocationHint location={pendingLocation} />
      <TaskForm
        location={pendingLocation ?? undefined}
        vineyardId={vineyardId}
        onSubmit={onSubmit}
        onCancel={onClose}
      />
    </Box>
  )

  if (isMobile) {
    return (
      <SwipeableDrawer
        anchor="bottom"
        open={open}
        onOpen={() => {}}
        onClose={onClose}
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
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 0 }}>{title}</DialogTitle>
      <DialogContent>{body}</DialogContent>
    </Dialog>
  )
}
