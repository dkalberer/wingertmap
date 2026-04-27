import { useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, Box,
  Button, Divider, CircularProgress, Alert,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import type { Vine } from '../../types'
import type { CreateTaskParams } from '../../api/tasks'
import { useTaskStore } from '../../store/taskStore'
import TaskList from './TaskList'
import TaskForm from './TaskForm'

interface Props {
  vine: Vine | null
  onClose: () => void
}

export default function VineTaskDialog({ vine, onClose }: Props) {
  const [showForm, setShowForm] = useState(false)
  const { tasks, loading, error, create } = useTaskStore()

  const vineTasks = vine ? tasks.filter((t) => t.vineId === vine.id) : []

  async function handleCreate(params: CreateTaskParams) {
    const task = await create(params)
    setShowForm(false)
    return task
  }

  return (
    <Dialog open={!!vine} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Rebe {vine?.vineNumber} — Aufgaben</DialogTitle>
      <DialogContent>
        {loading && <CircularProgress size={20} sx={{ display: 'block', mx: 'auto', my: 2 }} />}
        {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
        {!loading && (
          <Box>
            <TaskList tasks={vineTasks} />
            <Divider sx={{ my: 1.5 }} />
            {showForm ? (
              <TaskForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
            ) : (
              <Button size="small" startIcon={<AddIcon />} onClick={() => setShowForm(true)} sx={{ minHeight: 44 }}>
                Neue Aufgabe
              </Button>
            )}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  )
}
