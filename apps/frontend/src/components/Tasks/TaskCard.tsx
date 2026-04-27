import { useState, useRef, useEffect } from 'react'
import {
  Card, CardContent, CardActions, Typography, Chip, Button,
  IconButton, Box, ImageList, ImageListItem, CircularProgress,
  Popover,
} from '@mui/material'
import MyLocationIcon from '@mui/icons-material/MyLocation'
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate'
import DeleteIcon from '@mui/icons-material/Delete'
import type { Task, TaskStatus } from '../../types'
import { listPhotos, uploadPhoto } from '../../api/photos'
import type { TaskPhoto } from '../../api/photos'
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_NEXT,
  TASK_STATUS_NEXT_LABEL,
  labelForCategory,
  iconForCategory,
} from '../../utils/taskLabels'

interface Props {
  task: Task
  onStatusChange: (id: string, status: TaskStatus) => void
  onLocate?: (task: Task) => void
  onDelete?: (id: string) => void
}

const statusColor: Record<TaskStatus, 'default' | 'warning' | 'success'> = {
  offen:          'default',
  in_bearbeitung: 'warning',
  erledigt:       'success',
}

function isOverdue(task: Task): boolean {
  if (!task.dueDate || task.status === 'erledigt') return false
  return new Date(task.dueDate) < new Date(new Date().toDateString())
}

function isDueToday(task: Task): boolean {
  if (!task.dueDate || task.status === 'erledigt') return false
  return new Date(task.dueDate).toDateString() === new Date().toDateString()
}

export default function TaskCard({ task, onStatusChange, onLocate, onDelete }: Props) {
  const next = TASK_STATUS_NEXT[task.status]
  const [photos, setPhotos] = useState<TaskPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Delete confirmation popover
  const [deleteAnchor, setDeleteAnchor] = useState<HTMLElement | null>(null)

  const overdue = isOverdue(task)
  const today = isDueToday(task)

  useEffect(() => {
    listPhotos(task.id).then(setPhotos).catch(() => {})
  }, [task.id])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const photo = await uploadPhoto(task.id, file)
      setPhotos((prev) => [...prev, photo])
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: overdue ? 'error.light' : today ? 'warning.light' : undefined,
        opacity: task.status === 'erledigt' ? 0.65 : 1,
      }}
    >
      <CardContent sx={{ pb: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 0.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
            {iconForCategory(task.category)} {task.title || labelForCategory(task.category)}
          </Typography>
          {task.location && onLocate && (
            <IconButton
              size="small"
              onClick={() => onLocate(task)}
              title="Auf Karte zeigen"
              sx={{ minWidth: 44, minHeight: 44, ml: 0.5 }}
            >
              <MyLocationIcon fontSize="small" />
            </IconButton>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
          <Chip
            label={TASK_STATUS_LABELS[task.status]}
            color={statusColor[task.status]}
            size="small"
          />
          {task.dueDate && (
            <Typography
              variant="caption"
              sx={{
                color: overdue ? 'error.main' : today ? 'warning.main' : 'text.secondary',
                fontWeight: (overdue || today) ? 700 : 400,
              }}
            >
              {overdue ? '⚠ Überfällig ' : today ? '⏰ Heute ' : ''}
              {new Date(task.dueDate).toLocaleDateString('de-CH')}
            </Typography>
          )}
        </Box>

        {task.notes && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {task.notes}
          </Typography>
        )}

        {photos.length > 0 && (
          <ImageList cols={3} rowHeight={64} sx={{ mt: 1, mb: 0 }}>
            {photos.map((p) => (
              <ImageListItem key={p.id}>
                <img
                  src={p.url}
                  alt=""
                  style={{ objectFit: 'cover', width: '100%', height: '100%', borderRadius: 4, cursor: 'pointer' }}
                  onClick={() => window.open(p.url, '_blank')}
                />
              </ImageListItem>
            ))}
          </ImageList>
        )}
      </CardContent>

      <CardActions sx={{ pt: 0.5, gap: 0 }}>
        {next && (
          <Button
            size="small"
            onClick={() => onStatusChange(task.id, next)}
            sx={{ minHeight: 44 }}
          >
            {TASK_STATUS_NEXT_LABEL[task.status]}
          </Button>
        )}
        <Box sx={{ ml: 'auto', display: 'flex' }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <IconButton
            size="small"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            title="Foto hinzufügen"
            sx={{ minWidth: 44, minHeight: 44 }}
          >
            {uploading ? <CircularProgress size={18} /> : <AddPhotoAlternateIcon fontSize="small" />}
          </IconButton>
          {onDelete && (
            <>
              <IconButton
                size="small"
                onClick={(e) => setDeleteAnchor(e.currentTarget)}
                title="Aufgabe löschen"
                sx={{ color: 'error.main', minWidth: 44, minHeight: 44 }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
              <Popover
                open={!!deleteAnchor}
                anchorEl={deleteAnchor}
                onClose={() => setDeleteAnchor(null)}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
              >
                <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="body2">Aufgabe löschen?</Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      color="error"
                      variant="contained"
                      onClick={() => { onDelete(task.id); setDeleteAnchor(null) }}
                      sx={{ minHeight: 44, flex: 1 }}
                    >
                      Löschen
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setDeleteAnchor(null)}
                      sx={{ minHeight: 44, flex: 1 }}
                    >
                      Abbrechen
                    </Button>
                  </Box>
                </Box>
              </Popover>
            </>
          )}
        </Box>
      </CardActions>
    </Card>
  )
}
