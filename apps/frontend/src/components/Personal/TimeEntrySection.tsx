import { useRef, useState } from 'react'
import {
  Box, Button, Divider, IconButton, List, ListItem, ListItemText,
  MenuItem, Select, TextField, Typography, Alert,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import DownloadIcon from '@mui/icons-material/Download'
import UploadIcon from '@mui/icons-material/Upload'
import type { Vineyard } from '../../types'
import { usePersonalStore } from '../../store/personalStore'
import { exportTimeEntries, importTimeEntries, type ImportResult } from '../../api/timeEntries'

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

interface Props {
  vineyard: Vineyard | null
}

export default function TimeEntrySection({ vineyard }: Props) {
  const { employees, workTypes, entries, year, setYear, createEntry, removeEntry } = usePersonalStore()
  const [showForm, setShowForm] = useState(false)
  const [employeeIds, setEmployeeIds] = useState<string[]>([])
  const [workTypeId, setWorkTypeId] = useState('')
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10))
  const [hours, setHours] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleExport() {
    await exportTimeEntries(year)
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportResult(null)
    setImportError('')
    try {
      const result = await importTimeEntries(file)
      setImportResult(result)
      await usePersonalStore.getState().loadAll()
    } catch {
      setImportError('Import fehlgeschlagen.')
    } finally {
      e.target.value = ''
    }
  }

  async function handleSubmit() {
    if (employeeIds.length === 0 || !entryDate || !hours) return
    setSaving(true)
    try {
      await Promise.all(employeeIds.map((employeeId) =>
        createEntry({
          employeeId,
          workTypeId: workTypeId || undefined,
          vineyardId: vineyard?.id || undefined,
          entryDate,
          hours: parseFloat(hours),
          description: description || undefined,
        })
      ))
      setShowForm(false)
      setEmployeeIds([])
      setWorkTypeId('')
      setHours('')
      setDescription('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, pt: 1.5, gap: 1 }}>
        <Typography variant="caption" color="text.secondary">Jahr:</Typography>
        <Select size="small" value={year} onChange={(e) => setYear(Number(e.target.value))} sx={{ fontSize: '0.8rem' }}>
          {[year - 1, year, year + 1].map((y) => (
            <MenuItem key={y} value={y}>{y}</MenuItem>
          ))}
        </Select>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5 }}>
          <IconButton size="small" title="Exportieren" onClick={handleExport}>
            <DownloadIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" title="Importieren" onClick={() => fileInputRef.current?.click()}>
            <UploadIcon fontSize="small" />
          </IconButton>
          <input ref={fileInputRef} type="file" accept=".csv" hidden onChange={handleImportFile} />
        </Box>
      </Box>

      {importResult && (
        <Alert
          severity={importResult.skipped > 0 ? 'warning' : 'success'}
          onClose={() => setImportResult(null)}
          sx={{ mx: 2, mt: 1 }}
        >
          {importResult.imported} Zeilen importiert
          {importResult.skipped > 0 && `, ${importResult.skipped} übersprungen`}
          {importResult.errors && importResult.errors.length > 0 && (
            <Box component="ul" sx={{ m: 0, pl: 2, mt: 0.5 }}>
              {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
            </Box>
          )}
        </Alert>
      )}
      {importError && (
        <Alert severity="error" onClose={() => setImportError('')} sx={{ mx: 2, mt: 1 }}>
          {importError}
        </Alert>
      )}

      <List dense disablePadding sx={{ maxHeight: 280, overflow: 'auto' }}>
        {entries.map((entry) => (
          <ListItem
            key={entry.id}
            secondaryAction={
              <IconButton edge="end" size="small" onClick={() => removeEntry(entry.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            }
          >
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}>
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                    {entry.employee?.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {entry.hours}h
                  </Typography>
                  {entry.workType && (
                    <Typography variant="caption" color="text.secondary">
                      · {entry.workType.name}
                    </Typography>
                  )}
                </Box>
              }
              secondary={`${new Date(entry.entryDate).toLocaleDateString('de-CH')}${entry.description ? ' · ' + entry.description : ''}`}
            />
          </ListItem>
        ))}
        {entries.length === 0 && (
          <ListItem>
            <ListItemText
              secondary={`Keine Einträge für ${MONTHS[0]}–${MONTHS[11]} ${year}`}
            />
          </ListItem>
        )}
      </List>

      <Divider />

      {showForm ? (
        <Box sx={{ px: 2, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Select
            size="small"
            displayEmpty
            multiple
            value={employeeIds}
            onChange={(e) => setEmployeeIds(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value as string[])}
            renderValue={(selected) =>
              (selected as string[]).length === 0
                ? 'Mitarbeiter wählen'
                : employees.filter((e) => (selected as string[]).includes(e.id)).map((e) => e.name).join(', ')
            }
            fullWidth
          >
            {employees.map((e) => <MenuItem key={e.id} value={e.id}>{e.name}</MenuItem>)}
          </Select>

          <Select
            size="small"
            displayEmpty
            value={workTypeId}
            onChange={(e) => setWorkTypeId(e.target.value)}
            fullWidth
          >
            <MenuItem value="">Tätigkeit (optional)</MenuItem>
            {workTypes.map((wt) => <MenuItem key={wt.id} value={wt.id}>{wt.name}</MenuItem>)}
          </Select>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              sx={{ flex: 2 }}
            />
            <TextField
              size="small"
              type="number"
              label="Stunden"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              slotProps={{ htmlInput: { min: 0.5, step: 0.5 } }}
              sx={{ flex: 1 }}
            />
          </Box>

          <TextField
            size="small"
            label="Notiz (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
          />

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="contained"
              onClick={handleSubmit}
              disabled={saving || employeeIds.length === 0 || !hours}
            >
              Speichern
            </Button>
            <Button size="small" onClick={() => setShowForm(false)}>Abbrechen</Button>
          </Box>
        </Box>
      ) : (
        <Box sx={{ px: 2, py: 1 }}>
          <Button size="small" startIcon={<AddIcon />} onClick={() => setShowForm(true)} sx={{ minHeight: 44 }}>
            Stunden erfassen
          </Button>
        </Box>
      )}
    </Box>
  )
}
