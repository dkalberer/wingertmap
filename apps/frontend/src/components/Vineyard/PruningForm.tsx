import { useState, FormEvent } from 'react'
import { Box, TextField, Button, Alert } from '@mui/material'
import type { CreatePruningParams } from '../../api/pruning'

interface Props {
  vineyardId: string
  onSubmit: (params: CreatePruningParams) => Promise<void>
  onCancel: () => void
}

export default function PruningForm({ vineyardId: _vineyardId, onSubmit, onCancel }: Props) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(String(currentYear))
  const [pruningDate, setPruningDate] = useState('')
  const [augenProRebe, setAugenProRebe] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const yearNum = parseInt(year)
    if (!yearNum || !pruningDate) {
      setError('Jahr und Datum sind Pflichtfelder')
      return
    }
    setLoading(true)
    setError('')
    try {
      await onSubmit({
        year: yearNum,
        pruningDate,
        schnittTyp: 'Bogenschnitt',
        augenProRebe: augenProRebe ? parseFloat(augenProRebe) : undefined,
        notes: notes || undefined,
      })
    } catch {
      setError('Fehler beim Speichern')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {error && <Alert severity="error" role="alert" sx={{ py: 0 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          label="Jahr"
          type="number"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          size="small"
          required
          slotProps={{ input: { inputProps: { min: 1900, max: currentYear, step: 1 } } }}
          sx={{ width: 100, flexShrink: 0 }}
        />
        <TextField
          label="Schnitttdatum"
          type="date"
          value={pruningDate}
          onChange={(e) => setPruningDate(e.target.value)}
          size="small"
          required
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ flex: 1 }}
        />
      </Box>

      <TextField
        label="Augen / Rebe"
        type="number"
        value={augenProRebe}
        onChange={(e) => setAugenProRebe(e.target.value)}
        size="small"
        slotProps={{ input: { inputProps: { min: 0, max: 99, step: 0.5, inputMode: 'decimal' } } }}
        helperText="Durchschnittlich belassene Augen pro Rebe"
      />

      <TextField
        label="Notizen"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        multiline
        rows={2}
        size="small"
      />

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
