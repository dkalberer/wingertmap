import { Box, Typography, Collapse } from '@mui/material'
import { useState } from 'react'
import type { Task, TaskStatus } from '../../types'
import TaskCard from './TaskCard'

interface Props {
  tasks: Task[]
  onStatusChange?: (id: string, status: TaskStatus) => void
  onLocate?: (task: Task) => void
  onDelete?: (id: string) => void
}

interface Group {
  key: string
  label: string
  tasks: Task[]
  defaultOpen: boolean
  urgent?: boolean
}

function getDateGroup(task: Task): 'overdue' | 'today' | 'week' | 'later' | 'done' {
  if (task.status === 'erledigt') return 'done'
  if (!task.dueDate) return 'later'
  const due = new Date(task.dueDate)
  const today = new Date(new Date().toDateString())
  if (due < today) return 'overdue'
  if (due.toDateString() === today.toDateString()) return 'today'
  const weekEnd = new Date(today)
  weekEnd.setDate(today.getDate() + 7)
  if (due <= weekEnd) return 'week'
  return 'later'
}

function CollapsibleGroup({ group }: { group: Group & { onStatusChange?: Props['onStatusChange']; onLocate?: Props['onLocate']; onDelete?: Props['onDelete'] } }) {
  const [open, setOpen] = useState(group.defaultOpen)

  return (
    <Box>
      <Box
        onClick={() => setOpen((v) => !v)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          py: 0.75,
          px: 0.5,
          borderRadius: 1,
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            color: group.urgent ? 'error.main' : 'text.secondary',
          }}
        >
          {group.label} ({group.tasks.length})
        </Typography>
        <Typography variant="caption" color="text.disabled">{open ? '▲' : '▼'}</Typography>
      </Box>
      <Collapse in={open}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pb: 1 }}>
          {group.tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onStatusChange={group.onStatusChange ?? (() => {})}
              onLocate={group.onLocate}
              onDelete={group.onDelete}
            />
          ))}
        </Box>
      </Collapse>
    </Box>
  )
}

export default function TaskList({ tasks, onStatusChange, onLocate, onDelete }: Props) {
  if (tasks.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
        Keine Aufgaben vorhanden.
      </Typography>
    )
  }

  const overdue = tasks.filter((t) => getDateGroup(t) === 'overdue')
  const today   = tasks.filter((t) => getDateGroup(t) === 'today')
  const week    = tasks.filter((t) => getDateGroup(t) === 'week')
  const later   = tasks.filter((t) => getDateGroup(t) === 'later')
  const done    = tasks.filter((t) => getDateGroup(t) === 'done')

  const groups: Group[] = [
    { key: 'overdue', label: '⚠ Überfällig', tasks: overdue, defaultOpen: true, urgent: true },
    { key: 'today',   label: '⏰ Heute',      tasks: today,   defaultOpen: true },
    { key: 'week',    label: '📅 Diese Woche', tasks: week,    defaultOpen: true },
    { key: 'later',   label: '📋 Später',      tasks: later,   defaultOpen: true },
    { key: 'done',    label: '✓ Erledigt',     tasks: done,    defaultOpen: false },
  ].filter((g) => g.tasks.length > 0)

  return (
    <Box>
      {groups.map((group) => (
        <CollapsibleGroup
          key={group.key}
          group={{ ...group, onStatusChange, onLocate, onDelete }}
        />
      ))}
    </Box>
  )
}
