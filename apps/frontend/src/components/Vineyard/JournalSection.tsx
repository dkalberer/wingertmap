import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  CircularProgress,
  Alert,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { useJournalStore } from '../../store/journalStore'

interface Props {
  vineyardId: string
}

export default function JournalSection({ vineyardId }: Props) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [draft, setDraft] = useState('')
  const [dirty, setDirty] = useState(false)

  const { journals, loading, saving, error, load, save } = useJournalStore()

  useEffect(() => {
    load(vineyardId)
  }, [vineyardId, load])

  useEffect(() => {
    const entry = journals.find((j) => j.year === year)
    setDraft(entry?.notes ?? '')
    setDirty(false)
  }, [year, journals])

  const handleSave = async () => {
    await save(vineyardId, year, draft)
    setDirty(false)
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Typography variant="overline" color="text.secondary" sx={{ flexGrow: 1 }}>
          Jahrgangs-Journal
        </Typography>
        <IconButton size="small" onClick={() => setYear((y) => y - 1)}>
          <ChevronLeftIcon fontSize="small" />
        </IconButton>
        <Typography variant="body2" sx={{ fontWeight: 'medium', minWidth: 36, textAlign: 'center' }}>
          {year}
        </Typography>
        <IconButton size="small" onClick={() => setYear((y) => y + 1)} disabled={year >= currentYear}>
          <ChevronRightIcon fontSize="small" />
        </IconButton>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

      {loading ? (
        <CircularProgress size={20} />
      ) : (
        <>
          <TextField
            multiline
            minRows={4}
            fullWidth
            placeholder="Wettereindrücke, besondere Ereignisse, Qualitätsgefühl…"
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setDirty(true) }}
            size="small"
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
            <Button
              variant="contained"
              size="small"
              onClick={handleSave}
              disabled={!dirty || saving}
            >
              {saving ? <CircularProgress size={16} /> : 'Speichern'}
            </Button>
          </Box>
        </>
      )}

      {journals.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Einträge: {journals.map((j) => j.year).join(', ')}
          </Typography>
        </Box>
      )}
    </Box>
  )
}
