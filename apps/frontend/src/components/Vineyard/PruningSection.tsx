import { useEffect, useState } from 'react'
import {
  Box, Typography, Button, IconButton, CircularProgress, Alert,
  List, ListItem, ListItemText, Collapse, Popover,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import { usePruningStore } from '../../store/pruningStore'
import { useHarvestStore } from '../../store/harvestStore'
import PruningForm from './PruningForm'
import PruningCorrelationTable from './PruningCorrelationTable'
import type { Vineyard } from '../../types'

interface Props {
  vineyard: Vineyard
}

export default function PruningSection({ vineyard }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [deleteAnchor, setDeleteAnchor] = useState<{ el: HTMLElement; id: string } | null>(null)

  const { records, loading, error, load, create, remove } = usePruningStore()
  const { harvests, load: loadHarvests } = useHarvestStore()

  useEffect(() => {
    load(vineyard.id)
    loadHarvests(vineyard.id)
  }, [vineyard.id, load, loadHarvests])

  async function handleCreate(params: Parameters<typeof create>[1]) {
    await create(vineyard.id, params)
    setShowForm(false)
  }

  async function handleDelete() {
    if (!deleteAnchor) return
    await remove(deleteAnchor.id)
    setDeleteAnchor(null)
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography variant="overline" color="text.secondary" sx={{ flexGrow: 1 }}>
          Rebschnitt
        </Typography>
        {!showForm && (
          <IconButton size="small" onClick={() => setShowForm(true)} aria-label="Rebschnitt hinzufügen">
            <AddIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 1, py: 0 }}>{error}</Alert>}

      <Collapse in={showForm}>
        <Box sx={{ mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
          <PruningForm
            vineyardId={vineyard.id}
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        </Box>
      </Collapse>

      {loading ? (
        <CircularProgress size={20} />
      ) : records.length === 0 && !showForm ? (
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
            <Button size="small" color="error" onClick={handleDelete}>
              Löschen
            </Button>
          </Box>
        </Box>
      </Popover>

      {(records.length > 0 || harvests.length > 0) && (
        <Box sx={{ mt: 2 }}>
          <PruningCorrelationTable records={records} harvests={harvests} />
        </Box>
      )}
    </Box>
  )
}
