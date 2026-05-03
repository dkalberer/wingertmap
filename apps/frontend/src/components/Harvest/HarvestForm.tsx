import { useState, FormEvent, useEffect } from 'react'
import {
  Box, TextField, Button, Alert, Select, MenuItem,
  FormControl, InputLabel, Typography,
} from '@mui/material'
import { useVarietyStore } from '../../store/varietyStore'
import type { CreateHarvestParams } from '../../api/harvests'

interface Props {
  vineyardId: string
  onSubmit: (params: CreateHarvestParams) => Promise<void>
  onCancel: () => void
}

export default function HarvestForm({ vineyardId: _vineyardId, onSubmit, onCancel }: Props) {
  const { varieties, load: loadVarieties } = useVarietyStore()
  const [varietyId, setVarietyId] = useState('')
  const [harvestDate, setHarvestDate] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [oechsle, setOechsle] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (varieties.length === 0) loadVarieties()
  }, [varieties.length, loadVarieties])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!varietyId || !harvestDate || !weightKg) {
      setError('Sorte, Datum und Gewicht sind Pflichtfelder')
      return
    }
    setLoading(true)
    setError('')
    try {
      await onSubmit({
        varietyId,
        harvestDate,
        weightKg: parseFloat(weightKg),
        oechsle: oechsle ? parseInt(oechsle) : undefined,
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
      {error && <Alert severity="error" sx={{ py: 0 }}>{error}</Alert>}

      <FormControl size="small" required>
        <InputLabel>Traubensorte</InputLabel>
        <Select value={varietyId} label="Traubensorte" onChange={(e) => setVarietyId(e.target.value)}>
          {varieties.length === 0 && (
            <MenuItem disabled value=""><em>Keine Sorten vorhanden</em></MenuItem>
          )}
          {varieties.map((v) => (
            <MenuItem key={v.id} value={v.id}>{v.name}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        label="Erntedatum"
        type="date"
        value={harvestDate}
        onChange={(e) => setHarvestDate(e.target.value)}
        size="small"
        required
        slotProps={{ inputLabel: { shrink: true } }}
      />

      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          label="Gewicht (kg)"
          type="number"
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value)}
          size="small"
          required
          slotProps={{ input: { inputProps: { min: 0, step: 0.1, inputMode: 'decimal' } } }}
          sx={{ flex: 1 }}
        />
        <TextField
          label="Oechsle"
          type="number"
          value={oechsle}
          onChange={(e) => setOechsle(e.target.value)}
          size="small"
          slotProps={{ input: { inputProps: { min: 0, inputMode: 'numeric' } } }}
          sx={{ flex: 1 }}
        />
      </Box>

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

      {varieties.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          Zuerst Sorten im Tab "Sorten" anlegen.
        </Typography>
      )}
    </Box>
  )
}
