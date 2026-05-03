import { Box, Typography, IconButton } from '@mui/material'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import PlaceIcon from '@mui/icons-material/Place'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import type { Task, TaskStatus } from '../../types'
import { labelForCategory, iconForCategory, isOverdue, isDueToday } from '../../utils/taskLabels'

interface Props {
  task: Task
  onStatusChange: (id: string, status: TaskStatus) => void
  onSelect: (task: Task) => void
}

// Color accent per category — encodes domain at a glance without reading text
const CATEGORY_ACCENT: Record<string, string> = {
  pflanzenschutz: '#2563eb',  // blue — chemical/protection
  rebenpflege:    '#16a34a',  // green — vine work
  infrastruktur:  '#78716c',  // stone — physical structures
  boden:          '#854d0e',  // brown — soil
  phaenologie:    '#7c3aed',  // purple — observation/science
  sonstiges:      '#64748b',  // slate — misc
}

export default function TaskRow({ task, onStatusChange, onSelect }: Props) {
  const done = task.status === 'erledigt'
  const overdue = isOverdue(task)
  const today = isDueToday(task)
  const accentColor = CATEGORY_ACCENT[task.category] ?? '#64748b'

  function handleCheck(e: React.MouseEvent) {
    e.stopPropagation()
    onStatusChange(task.id, done ? 'offen' : 'erledigt')
  }

  return (
    <Box
      onClick={() => onSelect(task)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(task) } }}
      aria-label={`${task.title || labelForCategory(task.category)}, ${done ? 'erledigt' : 'offen'}`}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        px: 0.5,
        py: 0.5,
        minHeight: 52,
        cursor: 'pointer',
        borderRadius: 1.5,
        '&:hover': { bgcolor: 'action.hover' },
        '&:active': { bgcolor: 'action.selected' },
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: 2,
        },
      }}
    >
      {/* Category accent bar — quick visual scan by domain */}
      <Box
        aria-hidden="true"
        sx={{
          width: 3,
          alignSelf: 'stretch',
          borderRadius: 2,
          bgcolor: done ? 'action.disabled' : accentColor,
          flexShrink: 0,
          opacity: done ? 0.35 : 1,
          transition: 'opacity 0.15s',
          minHeight: 28,
        }}
      />

      {/* Status toggle — only toggles between offen/erledigt for quick completion */}
      <IconButton
        size="small"
        onClick={handleCheck}
        disableRipple
        aria-label={done ? 'Als offen markieren' : 'Als erledigt markieren'}
        sx={{
          p: 0.75,
          color: done ? 'success.main' : 'action.disabled',
          transition: 'color 0.15s',
          '&:hover': {
            color: done ? 'action.disabled' : 'success.main',
            bgcolor: 'transparent',
          },
        }}
      >
        {done ? <CheckCircleIcon fontSize="small" /> : <RadioButtonUncheckedIcon fontSize="small" />}
      </IconButton>

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          noWrap
          sx={{
            color: done ? 'text.disabled' : 'text.primary',
            textDecoration: done ? 'line-through' : 'none',
            fontWeight: (overdue || today) && !done ? 500 : 400,
          }}
        >
          <Box component="span" aria-hidden="true" sx={{ mr: 0.5 }}>{iconForCategory(task.category)}</Box>
          {task.title || labelForCategory(task.category)}
        </Typography>

        {task.dueDate && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.125 }}>
            {overdue && !done && (
              <Box
                aria-hidden="true"
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: 'error.main',
                  flexShrink: 0,
                }}
              />
            )}
            <Typography
              variant="caption"
              sx={{
                color: overdue && !done ? 'error.main' : today && !done ? 'warning.dark' : 'text.disabled',
                fontWeight: (overdue || today) && !done ? 600 : 400,
              }}
            >
              {new Date(task.dueDate).toLocaleDateString('de-CH')}
            </Typography>
            {task.location && (
              <PlaceIcon sx={{ fontSize: 11, color: 'text.disabled', ml: 0.25 }} aria-hidden="true" />
            )}
          </Box>
        )}
      </Box>

      <ChevronRightIcon
        sx={{ fontSize: 16, color: 'text.disabled', flexShrink: 0 }}
        aria-hidden="true"
      />
    </Box>
  )
}
