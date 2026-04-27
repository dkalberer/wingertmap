import { useState } from 'react'
import { useEffect } from 'react'
import {
  List, ListItem, ListItemButton, ListItemText,
  CircularProgress, Alert, Typography, IconButton, Box,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import type { Vineyard } from '../../types'
import { useVineyardStore } from '../../store/vineyardStore'

const FAVORITE_KEY = 'favoriteVineyardId'

interface Props {
  onSelect: (v: Vineyard) => void
}

export default function VineyardList({ onSelect }: Props) {
  const { vineyards, loading, error, remove, load } = useVineyardStore()
  useEffect(() => { load() }, [load])
  function handleSelect(v: Vineyard) {
    onSelect(v)
  }

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
  if (vineyards.length === 0) return (
    <Typography variant="body2" sx={{ p: 2, color: 'text.secondary' }}>Keine Wingerte vorhanden.</Typography>
  )

  return (
    <>
      <List dense disablePadding>
        {vineyards.map((v) => (
          <ListItem
            key={v.id}
            disablePadding
            secondaryAction={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <IconButton
                  size="small"
                  onClick={(e) => toggleFavorite(v, e)}
                  title={favoriteId === v.id ? 'Favorit entfernen' : 'Als Favorit setzen'}
                >
                  {favoriteId === v.id
                    ? <StarIcon fontSize="small" color="warning" />
                    : <StarBorderIcon fontSize="small" />}
                </IconButton>
                <IconButton
                  edge="end"
                  size="small"
                  onClick={(e) => { e.stopPropagation(); setToDelete(v) }}
                  title="Wingert löschen"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            }
          >
            <ListItemButton onClick={() => handleSelect(v)} sx={{ pr: 9 }}>
              <ListItemText primary={v.name} secondary={v.description} />
            </ListItemButton>
          </ListItem>
        ))}
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
