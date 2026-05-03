import { useState } from 'react'
import {
  SwipeableDrawer, Box, Typography, Button, Chip,
  Select, MenuItem, TextField, IconButton,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { usePersonalStore } from '../../store/personalStore'
import { useMobile } from '../../hooks/useMobile'
import type { Vineyard } from '../../types'

interface Props {
  open: boolean
  vineyard: Vineyard | null
  onClose: () => void
}

export default function QuickTimeEntrySheet({ open, vineyard, onClose }: Props) {
  const isMobile = useMobile()
  const inputSize = isMobile ? 'medium' : 'small'
  const { employees, workTypes, createEntry } = usePersonalStore()

  const [employeeIds, setEmployeeIds] = useState<string[]>([])
  const [workTypeId, setWorkTypeId] = useState('')
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10))
  const [hours, setHours] = useState('')
  const [saving, setSaving] = useState(false)

  function toggleEmployee(id: string) {
    setEmployeeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  async function handleSubmit() {
    if (employeeIds.length === 0 || !hours) return
    setSaving(true)
    try {
      await Promise.all(employeeIds.map((employeeId) =>
        createEntry({
          employeeId,
          workTypeId: workTypeId || undefined,
          vineyardId: vineyard?.id || undefined,
          entryDate,
          hours: parseFloat(hours),
        })
      ))
      setEmployeeIds([])
      setWorkTypeId('')
      setHours('')
      setEntryDate(new Date().toISOString().slice(0, 10))
      onClose()
    } finally {
      setSaving(false)
    }
  }

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
          pb: 'max(env(safe-area-inset-bottom), 16px)',
        },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5, mb: 1 }}>
        <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'divider' }} />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>Stunden erfassen</Typography>
        <IconButton size="small" onClick={onClose} sx={{ minWidth: 44, minHeight: 44 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Employee chips */}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
            Mitarbeiter
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {employees.map((e) => (
              <Chip
                key={e.id}
                label={e.name}
                onClick={() => toggleEmployee(e.id)}
                color={employeeIds.includes(e.id) ? 'primary' : 'default'}
                variant={employeeIds.includes(e.id) ? 'filled' : 'outlined'}
              />
            ))}
            {employees.length === 0 && (
              <Typography variant="caption" color="text.secondary">
                Zuerst Mitarbeiter in Einstellungen anlegen.
              </Typography>
            )}
          </Box>
        </Box>

        <Select
          size={inputSize}
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
            size={inputSize}
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            sx={{ flex: 2 }}
          />
          <TextField
            size={inputSize}
            type="number"
            label="Stunden"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            slotProps={{ htmlInput: { min: 0.5, step: 0.5, inputMode: 'decimal' } }}
            sx={{ flex: 1 }}
          />
        </Box>

        {vineyard && (
          <Typography variant="caption" color="text.secondary">
            Wingert: {vineyard.name}
          </Typography>
        )}

        <Button
          variant="contained"
          size="large"
          onClick={handleSubmit}
          disabled={saving || employeeIds.length === 0 || !hours}
          sx={{ minHeight: 52 }}
        >
          Speichern
        </Button>
      </Box>
    </SwipeableDrawer>
  )
}
