import { useState } from 'react'
import {
  Box, Button, Divider, IconButton, List, ListItem, ListItemText,
  MenuItem, Select, TextField, Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import type { Vineyard } from '../../types'
import { usePersonalStore } from '../../store/personalStore'

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

interface Props {
  vineyard: Vineyard | null
}

export default function TimeEntrySection({ vineyard }: Props) {
  const { employees, workTypes, entries, year, setYear, createEntry, removeEntry } = usePersonalStore()
  const [showForm, setShowForm] = useState(false)
  const [employeeId, setEmployeeId] = useState('')
  const [workTypeId, setWorkTypeId] = useState('')
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10))
  const [hours, setHours] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!employeeId || !entryDate || !hours) return
    setSaving(true)
    try {
      await createEntry({
        employeeId,
        workTypeId: workTypeId || undefined,
        vineyardId: vineyard?.id || undefined,
        entryDate,
        hours: parseFloat(hours),
        description: description || undefined,
      })
      setShowForm(false)
      setEmployeeId('')
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
        {vineyard && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            {vineyard.name}
          </Typography>
        )}
      </Box>

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
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            fullWidth
          >
            <MenuItem value="" disabled>Mitarbeiter wählen</MenuItem>
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
              disabled={saving || !employeeId || !hours}
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
