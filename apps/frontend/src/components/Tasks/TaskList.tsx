import { Box, Typography, Collapse } from '@mui/material'
import { useState } from 'react'
import type { Task, TaskStatus } from '../../types'
import TaskRow from './TaskRow'

interface Props {
  tasks: Task[]
  onStatusChange: (id: string, status: TaskStatus) => void
  onSelect: (task: Task) => void
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

function CollapsibleGroup({ group }: { group: Group & { onStatusChange: Props['onStatusChange']; onSelect: Props['onSelect'] } }) {
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
        <Box sx={{ pb: 0.5 }}>
          {group.tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onStatusChange={group.onStatusChange}
              onSelect={group.onSelect}
            />
          ))}
        </Box>
      </Collapse>
    </Box>
  )
}

export default function TaskList({ tasks, onStatusChange, onSelect }: Props) {
  if (tasks.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center', px: 2 }}>
        <Typography sx={{ fontSize: 36, mb: 1 }}>✓</Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Keine offenen Aufgaben</Typography>
        <Typography variant="caption" color="text.secondary">
          Neue Aufgabe erstellen oder Standort auf der Karte wählen.
        </Typography>
      </Box>
    )
  }

  const buckets: Record<string, Task[]> = { overdue: [], today: [], week: [], later: [], done: [] }
  for (const t of tasks) buckets[getDateGroup(t)].push(t)

  const groups: Group[] = [
    { key: 'overdue', label: '⚠ Überfällig',  tasks: buckets.overdue, defaultOpen: true, urgent: true },
    { key: 'today',   label: '⏰ Heute',        tasks: buckets.today,   defaultOpen: true },
    { key: 'week',    label: '📅 Diese Woche',  tasks: buckets.week,    defaultOpen: true },
    { key: 'later',   label: '📋 Später',       tasks: buckets.later,   defaultOpen: true },
    { key: 'done',    label: '✓ Erledigt',      tasks: buckets.done,    defaultOpen: false },
  ].filter((g) => g.tasks.length > 0)

  return (
    <Box>
      {groups.map((group) => (
        <CollapsibleGroup
          key={group.key}
          group={{ ...group, onStatusChange, onSelect }}
        />
      ))}
    </Box>
  )
}
