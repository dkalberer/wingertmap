import { useEffect, useState } from 'react'
import {
  Box, Typography, IconButton, CircularProgress, Alert,
  List, ListItem, ListItemText, Popover, Button,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import { usePruningStore } from '../../store/pruningStore'
import type { Vineyard } from '../../types'

interface Props {
  vineyard: Vineyard
}

export default function PruningSection({ vineyard }: Props) {
  const [deleteAnchor, setDeleteAnchor] = useState<{ el: HTMLElement; id: string } | null>(null)

  const { records, loading, error, load, remove } = usePruningStore()

  useEffect(() => {
    load(vineyard.id)
  }, [vineyard.id, load])

  async function handleDelete() {
    if (!deleteAnchor) return
    await remove(deleteAnchor.id)
    setDeleteAnchor(null)
  }

  return (
    <Box>
      <Typography variant="overline" color="text.secondary" component="p" sx={{ mb: 1 }}>
        Rebschnitt
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 1, py: 0 }}>{error}</Alert>}

      {loading ? (
        <CircularProgress size={20} />
      ) : records.length === 0 ? (
        <Typography variant="body2" color="text.disabled" sx={{ mb: 1 }}>
          Noch keine Schnittdaten erfasst.
        </Typography>
      ) : (
        <List dense disablePadding sx={{ mb: 1 }}>
          {records.map((r) => (
            <ListItem
              key={r.id}
              disableGutters
              secondaryAction={
                <IconButton
                  size="small"
                  edge="end"
                  color="error"
                  aria-label="Eintrag löschen"
                  onClick={(e) => setDeleteAnchor({ el: e.currentTarget, id: r.id })}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              }
            >
              <ListItemText
                primary={`${r.year} — ${r.schnittTyp}`}
                secondary={r.augenProRebe != null ? `${r.augenProRebe} Augen/Rebe` : undefined}
                slotProps={{
                  primary: { sx: { fontWeight: 500, fontSize: '0.875rem' } },
                  secondary: { sx: { fontSize: '0.75rem' } },
                }}
              />
            </ListItem>
          ))}
        </List>
      )}

      <Popover
        open={!!deleteAnchor}
        anchorEl={deleteAnchor?.el}
        onClose={() => setDeleteAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="body2">Eintrag löschen?</Typography>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button size="small" variant="outlined" onClick={() => setDeleteAnchor(null)}>
              Abbrechen
            </Button>
            <Button size="small" color="error" variant="contained" onClick={handleDelete}>
              Löschen
            </Button>
          </Box>
        </Box>
      </Popover>
    </Box>
  )
}
