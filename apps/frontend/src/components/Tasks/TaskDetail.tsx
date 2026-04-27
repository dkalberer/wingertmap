import { useRef, useState } from 'react'
import {
  Box, Typography, IconButton, ToggleButton, ToggleButtonGroup,
  Chip, Divider, Button, ImageList, ImageListItem, CircularProgress, Alert,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlaceIcon from '@mui/icons-material/Place'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate'
import DeleteIcon from '@mui/icons-material/Delete'
import type { Task, TaskStatus } from '../../types'
import {
  TASK_STATUS_LABELS, CATEGORY_LABELS, SEVERITY_LABELS,
  labelForCategory, iconForCategory, isOverdue,
} from '../../utils/taskLabels'
import { listPhotos, uploadPhoto } from '../../api/photos'
import type { TaskPhoto } from '../../api/photos'
import { useEffect } from 'react'

interface Props {
  task: Task
  onBack: () => void
  onStatusChange: (id: string, status: TaskStatus) => void
  onLocate?: (task: Task) => void
  onDelete: (id: string) => void
}

const STATUS_ORDER: TaskStatus[] = ['offen', 'in_bearbeitung', 'erledigt']

export default function TaskDetail({ task, onBack, onStatusChange, onLocate, onDelete }: Props) {
  const [photos, setPhotos] = useState<TaskPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const overdue = isOverdue(task)

  useEffect(() => {
    listPhotos(task.id).then(setPhotos).catch(() => {})
  }, [task.id])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const photo = await uploadPhoto(task.id, file)
      setPhotos((p) => [...p, photo])
    } catch {
      setUploadError('Upload fehlgeschlagen. Bitte erneut versuchen.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 1, pt: 1, pb: 0.5, gap: 0.5 }}>
        <IconButton size="small" onClick={onBack} aria-label="Zurück">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Aufgabe
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', px: 2, pb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.3, mt: 0.5, mb: 2 }}>
          {iconForCategory(task.category)} {task.title || labelForCategory(task.category)}
        </Typography>

        <ToggleButtonGroup
          value={task.status}
          exclusive
          onChange={(_, v) => v && onStatusChange(task.id, v)}
          fullWidth
          size="small"
          sx={{ mb: 2 }}
        >
          {STATUS_ORDER.map((s) => (
            <ToggleButton
              key={s}
              value={s}
              sx={{
                fontSize: '0.7rem',
                fontWeight: 600,
                '&.Mui-selected': {
                  bgcolor: s === 'erledigt' ? 'success.main' : s === 'in_bearbeitung' ? 'warning.main' : 'primary.main',
                  color: 'white',
                  '&:hover': {
                    bgcolor: s === 'erledigt' ? 'success.dark' : s === 'in_bearbeitung' ? 'warning.dark' : 'primary.dark',
                  },
                },
              }}
            >
              {TASK_STATUS_LABELS[s]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Divider sx={{ mb: 2 }} />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            <Chip
              label={CATEGORY_LABELS[task.category]}
              size="small"
              variant="outlined"
            />
            {task.severity && (
              <Chip
                label={SEVERITY_LABELS[task.severity]}
                size="small"
                color={task.severity === 'hoch' ? 'error' : task.severity === 'mittel' ? 'warning' : 'default'}
                variant={task.severity === 'hoch' ? 'filled' : 'outlined'}
              />
            )}
            {task.phase && (
              <Chip label={task.phase} size="small" variant="outlined" />
            )}
          </Box>

          {task.dueDate && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarTodayIcon sx={{ fontSize: 16, color: overdue ? 'error.main' : 'text.secondary' }} />
              <Typography
                variant="body2"
                sx={{ color: overdue ? 'error.main' : 'text.primary', fontWeight: overdue ? 600 : 400 }}
              >
                {overdue ? 'Überfällig · ' : ''}
                {new Date(task.dueDate).toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Typography>
            </Box>
          )}

          {task.notes && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                Notizen
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap', color: 'text.primary' }}>
                {task.notes}
              </Typography>
            </Box>
          )}

          {task.location && onLocate && (
            <Box>
              <Button
                size="small"
                startIcon={<PlaceIcon />}
                onClick={() => onLocate(task)}
                variant="outlined"
                fullWidth
                sx={{ justifyContent: 'flex-start' }}
              >
                Auf Karte zeigen
              </Button>
            </Box>
          )}

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
              Fotos
            </Typography>
            {photos.length > 0 && (
              <ImageList cols={3} rowHeight={80} sx={{ mt: 0.5, mb: 0 }}>
                {photos.map((p) => (
                  <ImageListItem key={p.id} sx={{ borderRadius: 1, overflow: 'hidden', cursor: 'pointer' }} onClick={() => window.open(p.url, '_blank')}>
                    <img src={p.url} alt="" style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                  </ImageListItem>
                ))}
              </ImageList>
            )}
            {uploadError && (
              <Alert severity="error" onClose={() => setUploadError(null)} sx={{ mt: 0.5, py: 0 }}>
                {uploadError}
              </Alert>
            )}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={handleUpload} />
            <Button
              size="small"
              startIcon={uploading ? <CircularProgress size={14} /> : <AddPhotoAlternateIcon />}
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              sx={{ mt: 0.5 }}
            >
              Foto hinzufügen
            </Button>
          </Box>
        </Box>

        <Divider sx={{ mt: 2, mb: 1.5 }} />

        {!confirmDelete ? (
          <Button
            size="small"
            startIcon={<DeleteIcon />}
            color="error"
            onClick={() => setConfirmDelete(true)}
            fullWidth
            sx={{ justifyContent: 'flex-start' }}
          >
            Aufgabe löschen
          </Button>
        ) : (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              color="error"
              variant="contained"
              onClick={() => { onDelete(task.id); onBack() }}
              sx={{ flex: 1 }}
            >
              Löschen
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setConfirmDelete(false)}
              sx={{ flex: 1 }}
            >
              Abbrechen
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  )
}
