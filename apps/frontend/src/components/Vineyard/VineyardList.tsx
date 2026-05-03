import { useState, useEffect } from 'react'
import {
  List, ListItem, ListItemButton, ListItemText,
  CircularProgress, Alert, Typography, IconButton, Box, Badge,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import MapIcon from '@mui/icons-material/Map'
import type { Vineyard } from '../../types'
import { useVineyardStore } from '../../store/vineyardStore'
import { useTaskStore } from '../../store/taskStore'

const FAVORITE_KEY = 'favoriteVineyardId'

interface Props {
  onSelect: (v: Vineyard) => void
}

export default function VineyardList({ onSelect }: Props) {
  const { vineyards, loading, error, remove, load } = useVineyardStore()
  const { tasks } = useTaskStore()
  useEffect(() => { load() }, [load])

  const [favoriteId, setFavoriteId] = useState<string | null>(() => localStorage.getItem(FAVORITE_KEY))

  function toggleFavorite(v: Vineyard, e: React.MouseEvent) {
    e.stopPropagation()
    const newFav = favoriteId === v.id ? null : v.id
    if (newFav) {
      localStorage.setItem(FAVORITE_KEY, newFav)
    } else {
      localStorage.removeItem(FAVORITE_KEY)
    }
    setFavoriteId(newFav)
  }

  const [toDelete, setToDelete] = useState<Vineyard | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await remove(toDelete.id)
    } finally {
      setDeleting(false)
      setToDelete(null)
    }
  }

  if (loading) return <CircularProgress size={24} sx={{ m: 2 }} />
  if (error) return <Alert severity="error" sx={{ m: 1 }}>{error}</Alert>

  if (vineyards.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <MapIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} aria-hidden="true" />
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
          Noch kein Wingert angelegt
        </Typography>
        <Typography variant="caption" color="text.secondary" component="p">
          Zeichne eine Fläche auf der Karte, um deinen ersten Wingert zu erstellen.
        </Typography>
      </Box>
    )
  }

  return (
    <>
      <List dense disablePadding>
        {vineyards.map((v) => {
          // Count open tasks for this vineyard for the badge
          const openCount = tasks.filter(
            (t) => t.vineyardId === v.id && t.status !== 'erledigt'
          ).length

          return (
            <ListItem
              key={v.id}
              disablePadding
              secondaryAction={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <IconButton
                    size="small"
                    onClick={(e) => toggleFavorite(v, e)}
                    aria-label={favoriteId === v.id ? 'Favorit entfernen' : 'Als Favorit setzen'}
                    title={favoriteId === v.id ? 'Favorit entfernen' : 'Als Favorit setzen'}
                  >
                    {favoriteId === v.id
                      ? <StarIcon fontSize="small" color="warning" />
                      : <StarBorderIcon fontSize="small" />}
                  </IconButton>
                  <IconButton
                    edge="end"
                    size="small"
                    color="error"
                    onClick={(e) => { e.stopPropagation(); setToDelete(v) }}
                    aria-label={`${v.name} löschen`}
                    title="Wingert löschen"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              }
            >
              <ListItemButton onClick={() => onSelect(v)} sx={{ pr: 9 }}>
                <Badge
                  badgeContent={openCount}
                  color="error"
                  max={99}
                  sx={{ '& .MuiBadge-badge': { right: -6, top: 6 } }}
                >
                  <ListItemText
                    primary={v.name}
                    secondary={v.description}
                    slotProps={{ primary: { sx: { fontWeight: 500 } } }}
                  />
                </Badge>
              </ListItemButton>
            </ListItem>
          )
        })}
      </List>

      <Dialog open={!!toDelete} onClose={() => setToDelete(null)}>
        <DialogTitle>Wingert löschen?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            «{toDelete?.name}» und alle dazugehörigen Reihen, Reben und Aufgaben werden unwiderruflich gelöscht.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToDelete(null)}>Abbrechen</Button>
          <Button color="error" onClick={confirmDelete} loading={deleting}>Löschen</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
