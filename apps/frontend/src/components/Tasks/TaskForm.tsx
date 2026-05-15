import { useState, useRef, useEffect, FormEvent } from 'react'
import {
  TextField, Button, Alert, Box, ToggleButtonGroup, ToggleButton,
  Typography, IconButton, Select, MenuItem, FormControl, InputLabel, Chip,
  CircularProgress, ListSubheader,
} from '@mui/material'
import { useMobile } from '../../hooks/useMobile'
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate'
import CloseIcon from '@mui/icons-material/Close'
import type { GeoJSONPoint, Task, RecordType, TaskCategory, Severity, TaskSubtype, SprayPayload } from '../../types'
import SprayFields from './SprayFields'
import { SEVERITY_LABELS, PHASE_OPTIONS, PHASE_GROUPS, CATEGORY_LABELS } from '../../utils/taskLabels'
import { uploadPhoto } from '../../api/photos'
import { usePersonalStore } from '../../store/personalStore'

type BeobachtungType = 'phaenologie' | 'pflanzenschutz'

interface Props {
  location?: GeoJSONPoint
  vineyardId?: string
  mode?: 'pflanzenschutz'
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
    subtype?: TaskSubtype
    spray?: SprayPayload
  }) => Promise<Task>
  onCancel: () => void
}

const SUBTYPE_TITLES: Record<TaskSubtype, string> = {
  'spritzung': 'Spritzung',
  'dispenser-haengen': 'Dispenser aufhängen',
  'maehen': 'Mähen',
}

export default function TaskForm({ location, vineyardId, mode, onSubmit, onCancel }: Props) {
  const isMobile = useMobile()
  const inputSize = isMobile ? 'medium' : 'small'
  const { workTypes, loading: workTypesLoading, loadAll } = usePersonalStore()

  useEffect(() => { loadAll() }, [loadAll])

  const [recordType, setRecordType] = useState<RecordType>('aufgabe')
  const [selectedWorkTypeId, setSelectedWorkTypeId] = useState<string>('')
  const [beobachtungType, setBeobachtungType] = useState<BeobachtungType>('phaenologie')
  const [severity, setSeverity] = useState<Severity | ''>('')
  const [phase, setPhase] = useState('')
  const [notes, setNotes] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [observationDate, setObservationDate] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [subtype, setSubtype] = useState<TaskSubtype | ''>('')
  const [spray, setSpray] = useState<SprayPayload>({ productIds: [], substanceIds: [] })
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

    let title: string
    let category: TaskCategory

    if (mode === 'pflanzenschutz') {
      if (!subtype) { setError('Bitte Massnahmen-Typ wählen'); return }
      title = SUBTYPE_TITLES[subtype]
      category = 'pflanzenschutz'
    } else if (recordType === 'aufgabe') {
      const wt = workTypes.find((w) => w.id === selectedWorkTypeId)
      if (!wt) { setError('Bitte eine Tätigkeit auswählen'); return }
      title = wt.name
      category = wt.name.toLowerCase().includes('pflanzenschutz') ? 'pflanzenschutz' : 'sonstiges'
    } else {
      title = CATEGORY_LABELS[beobachtungType] ?? beobachtungType
      category = beobachtungType
    }

    setLoading(true)
    try {
      const task = await onSubmit({
        title,
        recordType: mode === 'pflanzenschutz' ? 'aufgabe' : recordType,
        category,
        severity: mode !== 'pflanzenschutz' && recordType === 'beobachtung' && beobachtungType === 'pflanzenschutz' && severity ? severity : undefined,
        phase: mode !== 'pflanzenschutz' && recordType === 'beobachtung' && beobachtungType === 'phaenologie' && phase ? phase : undefined,
        notes: notes || undefined,
        dueDate: mode === 'pflanzenschutz' ? observationDate : recordType === 'beobachtung' ? observationDate : (dueDate || undefined),
        location,
        vineyardId,
        subtype: subtype || undefined,
        spray: subtype === 'spritzung' ? spray : undefined,
      })
      await Promise.all(pendingFiles.map((f) => uploadPhoto(task.id, f)))
    } catch {
      setError('Fehler beim Speichern')
    } finally {
      setLoading(false)
    }
  }

  const wtSelected = workTypes.find((w) => w.id === selectedWorkTypeId)
  const isPflanzenschutz =
    (recordType === 'aufgabe' && (wtSelected?.name.toLowerCase().includes('pflanzenschutz') ?? false)) ||
    (recordType === 'beobachtung' && beobachtungType === 'pflanzenschutz')

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {error && <Alert severity="error" role="alert">{error}</Alert>}

      {mode === 'pflanzenschutz' ? (
        <>
          {/* Pflanzenschutz mode: no Art toggle, no WorkType picker */}
          <FormControl size={inputSize} required>
            <InputLabel>Massnahmen-Typ</InputLabel>
            <Select
              value={subtype}
              label="Massnahmen-Typ"
              onChange={(e) => setSubtype(e.target.value as TaskSubtype)}
            >
              <MenuItem value="spritzung">Spritzung</MenuItem>
              <MenuItem value="dispenser-haengen">Dispenser aufhängen</MenuItem>
              <MenuItem value="maehen">Mähen</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Datum"
            type="date"
            value={observationDate}
            onChange={(e) => setObservationDate(e.target.value)}
            size={inputSize}
            slotProps={{ inputLabel: { shrink: true } }}
            helperText="Wann wurde die Massnahme durchgeführt?"
          />
          {subtype === 'spritzung' && <SprayFields value={spray} onChange={setSpray} />}
          <TextField
            id="task-notes"
            label="Notizen"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={2}
            size={inputSize}
          />
        </>
      ) : (
        <>
          {/* Art first — determines what appears below */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Art
            </Typography>
            <ToggleButtonGroup
              value={recordType}
              exclusive
              onChange={(_, v) => { if (v) { setRecordType(v); setError('') } }}
              size="small"
              fullWidth
            >
              <ToggleButton value="aufgabe" sx={{ minHeight: 44 }}>Aufgabe</ToggleButton>
              <ToggleButton value="beobachtung" sx={{ minHeight: 44 }}>Beobachtung</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Aufgabe: dynamic work type selection */}
          {recordType === 'aufgabe' && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Tätigkeit
              </Typography>
              {workTypesLoading ? (
                <CircularProgress size={20} sx={{ display: 'block', my: 1 }} />
              ) : workTypes.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  Keine Tätigkeiten vorhanden. Zuerst unter «Tätigkeiten» anlegen.
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {workTypes.map((wt) => (
                    <Chip
                      key={wt.id}
                      label={wt.name}
                      onClick={() => { setSelectedWorkTypeId(wt.id); setError('') }}
                      color={selectedWorkTypeId === wt.id ? 'primary' : 'default'}
                      variant={selectedWorkTypeId === wt.id ? 'filled' : 'outlined'}
                      sx={{ minHeight: 36 }}
                    />
                  ))}
                </Box>
              )}
            </Box>
          )}

          {/* Beobachtung: two fixed types */}
          {recordType === 'beobachtung' && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Typ
              </Typography>
              <ToggleButtonGroup
                value={beobachtungType}
                exclusive
                onChange={(_, v) => { if (v) setBeobachtungType(v) }}
                size="small"
                fullWidth
              >
                <ToggleButton value="phaenologie" sx={{ minHeight: 44, flexDirection: 'column', gap: 0.25, py: 0.75 }}>
                  <span aria-hidden="true" style={{ fontSize: '1.1rem' }}>🌿</span>
                  <Typography variant="caption" sx={{ lineHeight: 1.1 }}>Phänologie</Typography>
                </ToggleButton>
                <ToggleButton value="pflanzenschutz" sx={{ minHeight: 44, flexDirection: 'column', gap: 0.25, py: 0.75 }}>
                  <span aria-hidden="true" style={{ fontSize: '1.1rem' }}>💧</span>
                  <Typography variant="caption" sx={{ lineHeight: 1.1 }}>Pflanzenschutz</Typography>
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          )}

          {/* Phase — only for Phänologie observations */}
          {recordType === 'beobachtung' && beobachtungType === 'phaenologie' && (() => {
            const selectedPhase = PHASE_OPTIONS.find((p) => p.value === phase)
            return (
              <FormControl size={inputSize}>
                <InputLabel id="phase-label">Phase</InputLabel>
                <Select
                  labelId="phase-label"
                  value={phase}
                  label="Phase"
                  onChange={(e) => setPhase(e.target.value)}
                >
                  <MenuItem value=""><em>Keine</em></MenuItem>
                  {PHASE_GROUPS.map((group) => [
                    <ListSubheader key={group.key} sx={{ fontWeight: 700, lineHeight: '28px', fontSize: '0.7rem', bgcolor: 'action.hover' }}>
                      {group.label}
                    </ListSubheader>,
                    ...PHASE_OPTIONS.filter((p) => p.group === group.key).map((p) => (
                      <MenuItem key={p.value} value={p.value} sx={{ pl: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 2 }}>
                          <span>{p.label}</span>
                          <Typography component="span" variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                            {p.bbch}
                          </Typography>
                        </Box>
                      </MenuItem>
                    )),
                  ])}
                </Select>
                {selectedPhase && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, px: 1.5 }}>
                    {selectedPhase.description}
                  </Typography>
                )}
              </FormControl>
            )
          })()}

          {/* Severity — only for Pflanzenschutz observations */}
          {recordType === 'beobachtung' && beobachtungType === 'pflanzenschutz' && (
            <FormControl size={inputSize}>
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

          {isPflanzenschutz && (
            <FormControl size={inputSize}>
              <InputLabel>Massnahmen-Typ</InputLabel>
              <Select
                value={subtype}
                label="Massnahmen-Typ"
                onChange={(e) => setSubtype(e.target.value as TaskSubtype | '')}
              >
                <MenuItem value="">— bitte wählen —</MenuItem>
                <MenuItem value="spritzung">Spritzung</MenuItem>
                <MenuItem value="dispenser-haengen">Dispenser aufhängen</MenuItem>
                <MenuItem value="dispenser-entfernen">Dispenser entfernen</MenuItem>
                <MenuItem value="maehen">Mähen</MenuItem>
              </Select>
            </FormControl>
          )}
          {isPflanzenschutz && subtype === 'spritzung' && (
            <SprayFields value={spray} onChange={setSpray} />
          )}

          <TextField
            id="task-notes"
            label="Notizen"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            rows={2}
            size={inputSize}
          />
        </>
      )}

      {mode !== 'pflanzenschutz' && (
        recordType === 'beobachtung' ? (
          <TextField
            id="observation-date"
            label="Datum"
            type="date"
            value={observationDate}
            onChange={(e) => setObservationDate(e.target.value)}
            size={inputSize}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        ) : (
          <TextField
            id="task-due"
            label="Fälligkeitsdatum"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            size={inputSize}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        )
      )}

      <Box>
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
