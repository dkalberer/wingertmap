import { useState } from 'react'
import {
  Box, Typography, IconButton, Button, Popover, Divider,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import type { Harvest, GrapeColor } from '../../types'

const COLOR_DOT: Record<GrapeColor, string> = {
  weiss: '#f5f0e0',
  rot:   '#8b1a1a',
}

interface Props {
  harvests: Harvest[]
  onDelete: (id: string) => void
}

function groupByYear(harvests: Harvest[]): Map<number, Harvest[]> {
  const map = new Map<number, Harvest[]>()
  for (const h of harvests) {
    const year = new Date(h.harvestDate).getFullYear()
    if (!map.has(year)) map.set(year, [])
    map.get(year)!.push(h)
  }
  return new Map([...map.entries()].sort((a, b) => b[0] - a[0]))
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })
}

export default function HarvestList({ harvests, onDelete }: Props) {
  const [deleteAnchor, setDeleteAnchor] = useState<{ el: HTMLElement; id: string } | null>(null)

  if (harvests.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1 }}>
        Noch keine Ernteeinträge.
      </Typography>
    )
  }

  const grouped = groupByYear(harvests)

  return (
    <Box>
      {[...grouped.entries()].map(([year, entries]) => {
        const totalKg = entries.reduce((s, h) => s + h.weightKg, 0)
        return (
          <Box key={year}>
            <Box sx={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
              px: 2, py: 0.75, bgcolor: 'action.hover',
            }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{year}</Typography>
              <Typography variant="caption" color="text.secondary">
                {totalKg.toFixed(1)} kg gesamt
              </Typography>
            </Box>
            {entries.map((h, i) => (
              <Box key={h.id}>
                {i > 0 && <Divider />}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', px: 2, py: 1, gap: 1 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      {h.variety && (
                        <Box sx={{
                          width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                          bgcolor: COLOR_DOT[h.variety.color as GrapeColor] ?? '#ccc',
                          border: '1px solid', borderColor: 'divider',
                        }} />
                      )}
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {h.variety?.name ?? '—'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(h.harvestDate)}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {h.weightKg.toFixed(1)} kg
                      {h.oechsle != null ? ` · ${h.oechsle}°Oe` : ''}
                      {h.notes ? ` · ${h.notes}` : ''}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e) => setDeleteAnchor({ el: e.currentTarget, id: h.id })}
                    sx={{ color: 'error.main', minWidth: 36, minHeight: 36, flexShrink: 0 }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            ))}
          </Box>
        )
      })}

      <Popover
        open={!!deleteAnchor}
        anchorEl={deleteAnchor?.el}
        onClose={() => setDeleteAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="body2">Eintrag löschen?</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small" color="error" variant="contained"
              onClick={() => { if (deleteAnchor) { onDelete(deleteAnchor.id); setDeleteAnchor(null) } }}
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
    </Box>
  )
}
