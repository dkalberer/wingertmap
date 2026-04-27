import type { Task, TaskStatus, TaskCategory, Severity } from '../types'

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  pflanzenschutz: 'Pflanzenschutz',
  rebenpflege:    'Rebenpflege',
  infrastruktur:  'Infrastruktur',
  boden:          'Boden',
  phaenologie:    'Phänologie',
  sonstiges:      'Sonstiges',
}

export const CATEGORY_ICONS: Record<TaskCategory, string> = {
  pflanzenschutz: '💧',
  rebenpflege:    '✂️',
  infrastruktur:  '🔧',
  boden:          '🌱',
  phaenologie:    '🌿',
  sonstiges:      '📋',
}

export const SEVERITY_LABELS: Record<Severity, string> = {
  niedrig: 'Niedrig',
  mittel:  'Mittel',
  hoch:    'Hoch',
}

export const PHASE_OPTIONS = ['Austrieb', 'Blüte', 'Véraison', 'Reife']

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  offen:          'Offen',
  in_bearbeitung: 'In Arbeit',
  erledigt:       'Erledigt',
}

export const TASK_STATUS_NEXT: Record<TaskStatus, TaskStatus | null> = {
  offen:          'in_bearbeitung',
  in_bearbeitung: 'erledigt',
  erledigt:       null,
}

export const TASK_STATUS_NEXT_LABEL: Record<TaskStatus, string> = {
  offen:          '→ In Arbeit',
  in_bearbeitung: '✓ Erledigt',
  erledigt:       '',
}

export const ORDERED_CATEGORIES: TaskCategory[] = [
  'pflanzenschutz', 'rebenpflege', 'infrastruktur', 'boden', 'phaenologie', 'sonstiges',
]

export function isOverdue(t: Task): boolean {
  if (!t.dueDate || t.status === 'erledigt') return false
  return new Date(t.dueDate) < new Date(new Date().toDateString())
}

export function isDueToday(t: Task): boolean {
  if (!t.dueDate || t.status === 'erledigt') return false
  return new Date(t.dueDate).toDateString() === new Date().toDateString()
}

export function labelForCategory(category: string): string {
  return CATEGORY_LABELS[category as TaskCategory] ?? category
}

export function iconForCategory(category: string): string {
  return CATEGORY_ICONS[category as TaskCategory] ?? '📋'
}
