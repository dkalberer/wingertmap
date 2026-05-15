import { useState, useEffect, useRef } from 'react'
import {
  Box, CircularProgress, Alert, Button, Divider,
} from '@mui/material'
import type { Task, GeoJSONPoint, TaskStatus } from '../../types'
import type { CreateTaskParams } from '../../api/tasks'
import TaskList from './TaskList'
import TaskDetail from './TaskDetail'
import CreateTaskDialog from './CreateTaskDialog'
import { useNavigationStore } from '../../store/navigationStore'
import { useMobile } from '../../hooks/useMobile'

interface Props {
  tasks: Task[]
  loading: boolean
  error: string | null
  pendingLocation: GeoJSONPoint | null
  selectedTask: Task | null
  fabTrigger?: number
  mode?: 'pflanzenschutz' | null
  onStartPicking: () => void
  onCancelPicking: () => void
  onCreate: (params: CreateTaskParams) => Promise<Task>
  onStatusChange: (id: string, status: TaskStatus) => void
  onDelete: (id: string) => void
  onLocate: (task: Task) => void
  onTaskSelect: (task: Task | null) => void
  onDialogClose?: () => void
}

export default function GlobalTasksPanel({
  tasks, loading, error,
  pendingLocation, selectedTask, fabTrigger,
  mode, onStartPicking, onCancelPicking,
  onCreate, onStatusChange, onDelete, onLocate, onTaskSelect, onDialogClose,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [subTab, setSubTab] = useState<0 | 1>(0)
  const consumeFAB = useNavigationStore((s) => s.consumeFAB)
  const isMobile = useMobile()
  const prevFabTriggerRef = useRef<number | null>(null)

  useEffect(() => {
    if (pendingLocation) setDialogOpen(true)
  }, [pendingLocation])

  useEffect(() => {
    const cur = fabTrigger ?? 0
    const prev = prevFabTriggerRef.current

    if (prev === null) {
      if (cur > 0) { setDialogOpen(true); consumeFAB() }
    } else if (cur > prev) {
      setDialogOpen(true); consumeFAB()
    }

    prevFabTriggerRef.current = cur
  }, [fabTrigger, consumeFAB])

  const liveTask = selectedTask ? (tasks.find((t) => t.id === selectedTask.id) ?? selectedTask) : null

  function handleDialogStartPicking() {
    setDialogOpen(false)
    setTimeout(() => onStartPicking(), 350)
  }

  async function handleSubmit(params: CreateTaskParams) {
    const task = await onCreate(params)
    setDialogOpen(false)
    onCancelPicking()
    onDialogClose?.()
    return task
  }

  function handleClose() {
    setDialogOpen(false)
    onCancelPicking()
    onDialogClose?.()
  }

  function handleBack() {
    // Return to the sub-tab matching the task's type
    if (liveTask) setSubTab(liveTask.recordType === 'beobachtung' ? 1 : 0)
    onTaskSelect(null)
  }

  if (liveTask) {
    return (
      <TaskDetail
        task={liveTask}
        onBack={handleBack}
        onStatusChange={onStatusChange}
        onLocate={onLocate}
        onDelete={(id) => { onDelete(id); onTaskSelect(null) }}
      />
    )
  }

  const aufgaben = tasks.filter((t) => t.recordType !== 'beobachtung')
  const beobachtungen = tasks.filter((t) => t.recordType === 'beobachtung')
  const visibleTasks = subTab === 0 ? aufgaben : beobachtungen

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', px: 1.5, pt: isMobile ? 0.5 : 1.5, pb: 1, gap: 1, flexShrink: 0 }}>
        <Button
          size="small"
          variant={subTab === 0 ? 'contained' : 'outlined'}
          onClick={() => setSubTab(0)}
          sx={{ flex: 1, minHeight: 36 }}
        >
          Tätigkeiten{aufgaben.filter((t) => t.status !== 'erledigt').length > 0
            ? ` (${aufgaben.filter((t) => t.status !== 'erledigt').length})`
            : ''}
        </Button>
        <Button
          size="small"
          variant={subTab === 1 ? 'contained' : 'outlined'}
          onClick={() => setSubTab(1)}
          sx={{ flex: 1, minHeight: 36 }}
        >
          Beobachtungen{beobachtungen.filter((t) => t.status !== 'erledigt').length > 0
            ? ` (${beobachtungen.filter((t) => t.status !== 'erledigt').length})`
            : ''}
        </Button>
      </Box>

      <Divider sx={{ flexShrink: 0 }} />

      {error && <Alert severity="error" sx={{ m: 1.5 }}>{error}</Alert>}

      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0, p: 1.5 }}>
        {loading ? (
          <CircularProgress size={18} sx={{ display: 'block', mx: 'auto', my: 1 }} />
        ) : (
          <TaskList
            tasks={visibleTasks}
            emptyText={subTab === 0 ? 'Keine offenen Tätigkeiten.' : 'Keine Beobachtungen erfasst.'}
            onStatusChange={onStatusChange}
            onSelect={onTaskSelect}
          />
        )}
      </Box>

      <CreateTaskDialog
        open={dialogOpen}
        pendingLocation={pendingLocation}
        mode={mode ?? undefined}
        onStartPicking={handleDialogStartPicking}
        onSubmit={handleSubmit}
        onClose={handleClose}
      />
    </Box>
  )
}
