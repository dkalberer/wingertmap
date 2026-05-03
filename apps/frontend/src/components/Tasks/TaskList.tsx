import { Box, Typography, Collapse } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { useState } from 'react'
import type { Task, TaskStatus } from '../../types'
import TaskRow from './TaskRow'

interface Props {
  tasks: Task[]
  emptyText?: string
  onStatusChange: (id: string, status: TaskStatus) => void
  onSelect: (task: Task) => void
  onNew?: () => void
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
    <Box sx={{ mb: 0.5 }}>
      {/* Semantic button — keyboard navigable, aria-expanded for screen readers */}
      <Box
        component="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`${group.label}, ${group.tasks.length} Einträge`}
        sx={{
          all: 'unset',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          cursor: 'pointer',
          py: 0.75,
          px: 0.5,
          borderRadius: 1,
          boxSizing: 'border-box',
          '&:hover': { bgcolor: 'action.hover' },
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: 1,
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Colored dot for urgent groups — not just color alone (text label also indicates urgency) */}
          {group.urgent && (
            <Box
              aria-hidden="true"
              sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'error.main', flexShrink: 0 }}
            />
          )}
          <Typography
            variant="caption"
            component="span"
            sx={{
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: group.urgent ? 'error.main' : 'text.secondary',
            }}
          >
            {group.label}
          </Typography>
          {/* Pill badge for count — more scannable than parenthetical text */}
          <Box
            component="span"
            aria-hidden="true"
            sx={{
              fontWeight: 600,
              color: 'text.disabled',
              bgcolor: 'action.hover',
              px: 0.75,
              py: 0.125,
              borderRadius: 10,
              fontSize: '0.65rem',
              lineHeight: 1.6,
            }}
          >
            {group.tasks.length}
          </Box>
        </Box>
        {/* MUI icons instead of ASCII ▲▼ */}
        {open
          ? <ExpandLessIcon sx={{ fontSize: 16, color: 'text.disabled' }} aria-hidden="true" />
          : <ExpandMoreIcon sx={{ fontSize: 16, color: 'text.disabled' }} aria-hidden="true" />}
      </Box>

      <Collapse in={open}>
        <Box sx={{ pb: 1 }}>
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

export default function TaskList({ tasks, emptyText, onStatusChange, onSelect }: Props) {
  if (tasks.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center', px: 2 }}>
        <Typography sx={{ fontSize: 36, mb: 1 }} aria-hidden="true">✓</Typography>
        <Typography variant="caption" color="text.secondary" component="p">
          {emptyText ?? 'Über den Quick-Add erfassen.'}
        </Typography>
      </Box>
    )
  }

  const buckets: Record<string, Task[]> = { overdue: [], today: [], week: [], later: [], done: [] }
  for (const t of tasks) buckets[getDateGroup(t)].push(t)

  const groups: Group[] = [
    { key: 'overdue', label: '⚠ Überfällig',  tasks: buckets.overdue, defaultOpen: true,  urgent: true },
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
