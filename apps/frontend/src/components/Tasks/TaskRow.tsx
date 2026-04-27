import { Box, Typography, IconButton } from '@mui/material'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked'
import PlaceIcon from '@mui/icons-material/Place'
import type { Task, TaskStatus } from '../../types'
import { labelForCategory, iconForCategory, isOverdue, isDueToday } from '../../utils/taskLabels'

interface Props {
  task: Task
  onStatusChange: (id: string, status: TaskStatus) => void
  onSelect: (task: Task) => void
}

export default function TaskRow({ task, onStatusChange, onSelect }: Props) {
  const done = task.status === 'erledigt'
  const inProgress = task.status === 'in_bearbeitung'
  const overdue = isOverdue(task)
  const today = isDueToday(task)

  function handleCheck(e: React.MouseEvent) {
    e.stopPropagation()
    onStatusChange(task.id, done ? 'offen' : 'erledigt')
  }

  return (
    <Box
      onClick={() => onSelect(task)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        px: 0.5,
        minHeight: 48,
        cursor: 'pointer',
        borderRadius: 1,
        '&:hover': { bgcolor: 'action.hover' },
        '&:active': { bgcolor: 'action.selected' },
      }}
    >
      <IconButton
        size="small"
        onClick={handleCheck}
        disableRipple
        sx={{
          p: 1,
          color: done ? 'success.main' : inProgress ? 'warning.main' : 'action.disabled',
          transition: 'color 0.15s',
          '&:hover': { color: done ? 'action.disabled' : 'success.main', bgcolor: 'transparent' },
        }}
      >
        {done
          ? <CheckCircleIcon fontSize="small" />
          : inProgress
            ? <RadioButtonCheckedIcon fontSize="small" />
            : <RadioButtonUncheckedIcon fontSize="small" />}
      </IconButton>

      <Box sx={{ flex: 1, minWidth: 0, pr: 0.5 }}>
        <Typography
          variant="body2"
          noWrap
          sx={{
            color: done ? 'text.disabled' : 'text.primary',
            textDecoration: done ? 'line-through' : 'none',
          }}
        >
          <Box component="span" sx={{ mr: 0.5 }}>{iconForCategory(task.category)}</Box>
          {task.title || labelForCategory(task.category)}
        </Typography>

        {task.dueDate && (
          <Typography
            variant="caption"
            sx={{
              color: overdue ? 'error.main' : today ? 'warning.main' : 'text.disabled',
              fontWeight: (overdue || today) ? 600 : 400,
              lineHeight: 1.3,
            }}
          >
            {overdue ? '⚠ ' : today ? '⏰ ' : ''}
            {new Date(task.dueDate).toLocaleDateString('de-CH')}
          </Typography>
        )}
      </Box>

      {task.location && (
        <PlaceIcon sx={{ fontSize: 14, color: 'text.disabled', mr: 0.5, flexShrink: 0 }} />
      )}

      <Box
        component="span"
        sx={{ color: 'text.disabled', fontSize: 12, mr: 0.5, flexShrink: 0 }}
        aria-hidden
      >
        ›
      </Box>
    </Box>
  )
}
