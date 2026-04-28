import { useState, useRef, FormEvent } from 'react'
import {
  TextField, Button, Alert, Box, ToggleButtonGroup, ToggleButton,
  Typography, IconButton, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material'
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate'
import CloseIcon from '@mui/icons-material/Close'
import type { GeoJSONPoint, Task, RecordType, TaskCategory, Severity } from '../../types'
import { ORDERED_CATEGORIES, CATEGORY_LABELS, CATEGORY_ICONS, SEVERITY_LABELS, PHASE_OPTIONS } from '../../utils/taskLabels'
import { uploadPhoto } from '../../api/photos'

interface Props {
  location?: GeoJSONPoint
  vineyardId?: string
  onSubmit: (params: {
    title: string
    recordType: RecordType
    category: TaskCategory
    severity?: Severity
    phase?: string
    notes?: string
    dueDate?: string
    location?: GeoJSONPoint
    vineyardId?: string
  }) => Promise<Task>
  onCancel: () => void
}

export default function TaskForm({ location, vineyardId, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState('')
  const [recordType, setRecordType] = useState<RecordType>('aufgabe')
  const [category, setCategory] = useState<TaskCategory>('sonstiges')
  const [severity, setSeverity] = useState<Severity | ''>('')
  const [phase, setPhase] = useState('')
  const [notes, setNotes] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length) setPendingFiles((prev) => [...prev, ...files])
    if (fileRef.current) fileRef.current.value = ''
  }

  function removeFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Titel fehlt'); return }
    setLoading(true)
    try {
      const task = await onSubmit({
        title: title.trim(),
        recordType,
        category,
        severity: recordType === 'beobachtung' && severity ? severity : undefined,
        phase: category === 'phaenologie' && phase ? phase : undefined,
        notes: notes || undefined,
        dueDate: dueDate || undefined,
        location,
        vineyardId,
      })
      await Promise.all(pendingFiles.map((f) => uploadPhoto(task.id, f)))
    } catch {
      setError('Fehler beim Speichern')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {error && <Alert severity="error" role="alert">{error}</Alert>}

      {/* Kategorie first — primary organizational choice */}
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          Kategorie
        </Typography>
        <ToggleButtonGroup
          value={category}
          exclusive
          onChange={(_, v) => { if (v) setCategory(v) }}
          size="small"
          sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', width: '100%' }}
        >
          {ORDERED_CATEGORIES.map((c) => (
            <ToggleButton
              key={c}
              value={c}
              sx={{
                flexDirection: 'column',
                gap: 0.25,
                py: 1,
                minHeight: 56,
                fontSize: '0.65rem',
                lineHeight: 1.2,
              }}
            >
              <span aria-hidden="true" style={{ fontSize: '1.25rem' }}>{CATEGORY_ICONS[c]}</span>
              {CATEGORY_LABELS[c]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* Art (type) second — secondary qualifier */}
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          Art
        </Typography>
        <ToggleButtonGroup
          value={recordType}
          exclusive
          onChange={(_, v) => { if (v) setRecordType(v) }}
          size="small"
          fullWidth
        >
          <ToggleButton value="aufgabe" sx={{ minHeight: 44 }}>Aufgabe</ToggleButton>
          <ToggleButton value="beobachtung" sx={{ minHeight: 44 }}>Beobachtung</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Conditional fields — only shown when relevant */}
      {recordType === 'beobachtung' && (
        <FormControl size="small">
          <InputLabel id="severity-label">Schweregrad</InputLabel>
          <Select
            labelId="severity-label"
            value={severity}
            label="Schweregrad"
            onChange={(e) => setSeverity(e.target.value as Severity | '')}
          >
            <MenuItem value=""><em>Kein</em></MenuItem>
            {(Object.keys(SEVERITY_LABELS) as Severity[]).map((s) => (
              <MenuItem key={s} value={s}>{SEVERITY_LABELS[s]}</MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {category === 'phaenologie' && (
        <FormControl size="small">
          <InputLabel id="phase-label">Phase</InputLabel>
          <Select
            labelId="phase-label"
            value={phase}
            label="Phase"
            onChange={(e) => setPhase(e.target.value)}
          >
            <MenuItem value=""><em>Keine</em></MenuItem>
            {PHASE_OPTIONS.map((p) => (
              <MenuItem key={p} value={p}>{p}</MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {/* Title last — user has context after picking category/type */}
      <TextField
        id="task-title"
        label="Titel"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        size="small"
        autoFocus
      />

      <TextField
        id="task-notes"
        label="Notizen"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        multiline
        rows={2}
        size="small"
      />
      <TextField
        id="task-due"
        label="Fälligkeitsdatum"
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        size="small"
        slotProps={{ inputLabel: { shrink: true } }}
      />

      <Box>
        {/* No capture="environment" — lets users choose camera OR photo library */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleFilePick}
        />
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddPhotoAlternateIcon />}
          onClick={() => fileRef.current?.click()}
          sx={{ minHeight: 44 }}
        >
          Fotos hinzufügen
        </Button>
        {pendingFiles.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
            {pendingFiles.map((f, i) => (
              <Box key={i} sx={{ position: 'relative', width: 64, height: 64 }}>
                <img
                  src={URL.createObjectURL(f)}
                  alt=""
                  style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 4 }}
                />
                <IconButton
                  size="small"
                  onClick={() => removeFile(i)}
                  aria-label="Foto entfernen"
                  sx={{
                    position: 'absolute', top: -8, right: -8,
                    bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
                    p: 0.25,
                    '&:hover': { bgcolor: 'background.paper' },
                  }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button type="submit" loading={loading} size="small" sx={{ minHeight: 44, flex: 1 }}>
          Speichern
        </Button>
        <Button variant="outlined" size="small" onClick={onCancel} sx={{ minHeight: 44 }}>
          Abbrechen
        </Button>
      </Box>
    </Box>
  )
}
