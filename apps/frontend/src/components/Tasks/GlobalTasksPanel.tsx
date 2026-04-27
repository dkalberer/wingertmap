import { useState, useEffect } from 'react'
import {
  Box, Button, Divider, CircularProgress, Alert, Stack,
} from '@mui/material'
import AddLocationAltIcon from '@mui/icons-material/AddLocationAlt'
import GpsFixedIcon from '@mui/icons-material/GpsFixed'
import AddIcon from '@mui/icons-material/Add'
import type { Task, GeoJSONPoint, TaskStatus } from '../../types'
import type { CreateTaskParams } from '../../api/tasks'
import TaskList from './TaskList'
import TaskDetail from './TaskDetail'
import CreateTaskDialog from './CreateTaskDialog'

interface Props {
  tasks: Task[]
  loading: boolean
  error: string | null
  pendingLocation: GeoJSONPoint | null
  selectedTask: Task | null
  onStartPicking: () => void
  onCancelPicking: () => void
  onGPSLocation: (p: GeoJSONPoint) => void
  onCreate: (params: CreateTaskParams) => Promise<Task>
  onStatusChange: (id: string, status: TaskStatus) => void
  onDelete: (id: string) => void
  onLocate: (task: Task) => void
  onTaskSelect: (task: Task | null) => void
}

export default function GlobalTasksPanel({
  tasks, loading, error,
  pendingLocation, selectedTask,
  onStartPicking, onCancelPicking, onGPSLocation,
  onCreate, onStatusChange, onDelete, onLocate, onTaskSelect,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)

  // When a location arrives (map pick or GPS), open the dialog automatically
  useEffect(() => {
    if (pendingLocation) setDialogOpen(true)
  }, [pendingLocation])

  // Keep selectedTask in sync: if the task was updated (e.g. status change), reflect latest
  const liveTask = selectedTask ? (tasks.find((t) => t.id === selectedTask.id) ?? selectedTask) : null

  function handleStartPick() {
    setGpsError(null)
    onStartPicking()
  }

  function handleUseGPS() {
    setGpsError(null)
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false)
        onCancelPicking()
        onGPSLocation({ type: 'Point', coordinates: [pos.coords.longitude, pos.coords.latitude] })
      },
      (err) => { setGpsLoading(false); setGpsError(err.message) },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  async function handleSubmit(params: CreateTaskParams) {
    const task = await onCreate(params)
    setDialogOpen(false)
    onCancelPicking()
    return task
  }

  function handleClose() {
    setDialogOpen(false)
    onCancelPicking()
  }

  if (liveTask) {
    return (
      <TaskDetail
        task={liveTask}
        onBack={() => onTaskSelect(null)}
        onStatusChange={onStatusChange}
        onLocate={onLocate}
        onDelete={(id) => { onDelete(id); onTaskSelect(null) }}
      />
    )
  }

  return (
    <Box sx={{ p: 1.5 }}>
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

      {loading ? (
        <CircularProgress size={18} sx={{ display: 'block', mx: 'auto', my: 1 }} />
      ) : (
        <TaskList tasks={tasks} onStatusChange={onStatusChange} onSelect={onTaskSelect} />
      )}

      <Divider sx={{ my: 1.5 }} />

      <Stack spacing={0.75}>
        {gpsError && <Alert severity="warning" sx={{ py: 0 }}>{gpsError}</Alert>}
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
          fullWidth
          variant="contained"
          sx={{ minHeight: 44 }}
        >
          Neue Aufgabe
        </Button>
        <Button
          size="small"
          startIcon={<AddLocationAltIcon />}
          onClick={handleStartPick}
          fullWidth
          variant="outlined"
          sx={{ minHeight: 44 }}
        >
          Standort auf Karte wählen
        </Button>
        <Button
          size="small"
          startIcon={gpsLoading ? <CircularProgress size={14} /> : <GpsFixedIcon />}
          onClick={handleUseGPS}
          fullWidth
          variant="outlined"
          disabled={gpsLoading}
          sx={{ minHeight: 44 }}
        >
          GPS-Position verwenden
        </Button>
      </Stack>

      <CreateTaskDialog
        open={dialogOpen}
        pendingLocation={pendingLocation}
        onSubmit={handleSubmit}
        onClose={handleClose}
      />
    </Box>
  )
}
