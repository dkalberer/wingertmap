import { useState, FormEvent } from 'react'
import { TextField, Button, Alert, Box, Chip } from '@mui/material'
import PentagonIcon from '@mui/icons-material/Pentagon'
import { useVineyardStore } from '../../store/vineyardStore'
import type { GeoJSONPolygon, Vineyard } from '../../types'

interface Props {
  onSuccess: (v: Vineyard) => void
  boundary?: GeoJSONPolygon
}

export default function VineyardForm({ onSuccess, boundary }: Props) {
  const { create } = useVineyardStore()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const v = await create(name, description, boundary)
      onSuccess(v)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? (e instanceof Error ? e.message : 'Fehler beim Speichern')
      setError(msg)
      console.error('Vineyard create failed:', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {error && <Alert severity="error" role="alert">{error}</Alert>}
      {boundary && (
        <Chip icon={<PentagonIcon />} label="Grenze gezeichnet" color="success" size="small" />
      )}
      <TextField
        id="vname"
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <TextField
        id="vdesc"
        label="Beschreibung"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        multiline
        rows={3}
      />
      <Button type="submit" loading={loading}>
        {loading ? 'Speichern...' : 'Wingert anlegen'}
      </Button>
    </Box>
  )
}
