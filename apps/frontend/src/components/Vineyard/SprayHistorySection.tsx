import { useState, useMemo } from 'react'
import {
  Box, Typography, List, ListItem, ListItemText, Button, Chip,
} from '@mui/material'
import { useTaskStore } from '../../store/taskStore'
import type { Task } from '../../types'

interface Props {
  vineyardId: string
}

const STATUS_COLOR: Record<Task['status'], 'default' | 'warning' | 'success'> = {
  offen:    'warning',
  erledigt: 'success',
}

const STATUS_LABEL: Record<Task['status'], string> = {
  offen:    'offen',
  erledigt: 'erledigt',
}

function taskDate(t: Task): string {
  const d = t.completedAt ?? t.dueDate ?? t.createdAt
  return new Date(d).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function sortKey(t: Task): number {
  return -new Date(t.completedAt ?? t.dueDate ?? t.createdAt).getTime()
}

const PREVIEW_COUNT = 5

export default function SprayHistorySection({ vineyardId }: Props) {
  const [showAll, setShowAll] = useState(false)

  const tasks = useTaskStore((s) => s.tasks)
  const sprays = useMemo(
    () => tasks
      .filter((t) => t.vineyardId === vineyardId && t.category === 'pflanzenschutz')
      .sort((a, b) => sortKey(a) - sortKey(b)),
    [tasks, vineyardId],
  )

  if (sprays.length === 0) return null

  const visible = showAll ? sprays : sprays.slice(0, PREVIEW_COUNT)
  const hasMore = sprays.length > PREVIEW_COUNT

  return (
    <Box>
      <Typography variant="overline" color="text.secondary" component="p" sx={{ mb: 0.5 }}>
        Spritzhistorie
      </Typography>

      <List dense disablePadding>
        {visible.map((t) => (
          <ListItem key={t.id} disableGutters alignItems="flex-start"
            sx={{ gap: 1, py: 0.5 }}>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, flex: 1 }}>
                    {t.title}
                  </Typography>
                  <Chip
                    label={STATUS_LABEL[t.status]}
                    size="small"
                    color={STATUS_COLOR[t.status]}
                    sx={{ fontSize: '0.65rem', height: 18 }}
                  />
                </Box>
              }
              secondary={
                <Box component="span" sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                  <Typography variant="caption" color="text.secondary" component="span">
                    {taskDate(t)}
                  </Typography>
                  {t.notes && (
                    <Typography variant="caption" color="text.secondary" component="span"
                      sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {t.notes}
                    </Typography>
                  )}
                </Box>
              }
            />
          </ListItem>
        ))}
      </List>

      {hasMore && (
        <Button
          size="small"
          onClick={() => setShowAll((v) => !v)}
          sx={{ mt: 0.5, px: 0, fontSize: '0.75rem' }}
        >
          {showAll ? 'Weniger anzeigen' : `Alle ${sprays.length} anzeigen`}
        </Button>
      )}
    </Box>
  )
}
