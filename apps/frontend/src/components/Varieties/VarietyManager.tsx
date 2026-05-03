import { useEffect, useState, FormEvent } from 'react'
import {
  Box, Typography, List, ListItem, ListItemText, IconButton,
  TextField, Button, ToggleButtonGroup, ToggleButton, Alert,
  CircularProgress, Divider, Popover,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import { useVarietyStore } from '../../store/varietyStore'
import type { GrapeColor } from '../../types'

const COLOR_LABELS: Record<GrapeColor, string> = {
  weiss: 'Weiss',
  rot:   'Rot',
}

const COLOR_DOT: Record<GrapeColor, string> = {
  weiss: '#f5f0e0',
  rot:   '#8b1a1a',
}

export default function VarietyManager() {
  const { varieties, loading, error, load, create, remove } = useVarietyStore()
  const [name, setName] = useState('')
  const [color, setColor] = useState<GrapeColor>('weiss')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteAnchor, setDeleteAnchor] = useState<{ el: HTMLElement; id: string } | null>(null)

  useEffect(() => { load() }, [load])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setFormError('Name fehlt'); return }
    setSaving(true)
    setFormError('')
    try {
      await create(name.trim(), color)
      setName('')
    } catch {
      setFormError('Fehler beim Speichern — Name bereits vorhanden?')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Traubensorten</Typography>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <CircularProgress size={24} sx={{ alignSelf: 'center' }} />
      ) : varieties.length === 0 ? (
        <Typography variant="body2" color="text.secondary">Noch keine Sorten erfasst.</Typography>
      ) : (
        <List dense disablePadding>
          {varieties.map((v, i) => (
            <Box key={v.id}>
              {i > 0 && <Divider />}
              <ListItem
                disableGutters
                secondaryAction={
                  <>
                    <IconButton
                      size="small"
                      onClick={(e) => setDeleteAnchor({ el: e.currentTarget, id: v.id })}
                      sx={{ color: 'error.main', minWidth: 44, minHeight: 44 }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                    <Popover
                      open={deleteAnchor?.id === v.id}
                      anchorEl={deleteAnchor?.el}
                      onClose={() => setDeleteAnchor(null)}
                      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                      transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                    >
                      <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Typography variant="body2">Sorte löschen?</Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            size="small" color="error" variant="contained"
                            onClick={() => { remove(v.id); setDeleteAnchor(null) }}
                            sx={{ minHeight: 44, flex: 1 }}
                          >
                            Löschen
                          </Button>
                          <Button
                            size="small" variant="outlined"
                            onClick={() => setDeleteAnchor(null)}
                            sx={{ minHeight: 44, flex: 1 }}
                          >
                            Abbrechen
                          </Button>
                        </Box>
                      </Box>
                    </Popover>
                  </>
                }
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 1 }}>
                  <Box sx={{
                    width: 12, height: 12, borderRadius: '50%',
                    bgcolor: COLOR_DOT[v.color as GrapeColor] ?? '#ccc',
                    border: '1px solid', borderColor: 'divider',
                    flexShrink: 0,
                  }} />
                  <ListItemText
                    primary={<Typography variant="body2">{v.name}</Typography>}
                    secondary={<Typography variant="caption">{COLOR_LABELS[v.color as GrapeColor] ?? v.color}</Typography>}
                  />
                </Box>
              </ListItem>
            </Box>
          ))}
        </List>
      )}

      <Divider />

      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          Neue Sorte
        </Typography>
        {formError && <Alert severity="error" sx={{ py: 0 }}>{formError}</Alert>}
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          size="small"
          required
        />
        <ToggleButtonGroup
          value={color}
          exclusive
          onChange={(_, v) => { if (v) setColor(v) }}
          size="small"
          fullWidth
        >
          {(Object.keys(COLOR_LABELS) as GrapeColor[]).map((c) => (
            <ToggleButton key={c} value={c} sx={{ minHeight: 44, gap: 0.5 }}>
              <Box sx={{
                width: 10, height: 10, borderRadius: '50%',
                bgcolor: COLOR_DOT[c],
                border: '1px solid', borderColor: 'divider',
              }} />
              {COLOR_LABELS[c]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Button type="submit" loading={saving} size="small" sx={{ minHeight: 44 }}>
          Hinzufügen
        </Button>
      </Box>
    </Box>
  )
}
