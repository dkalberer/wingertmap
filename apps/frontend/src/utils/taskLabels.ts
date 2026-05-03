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

export interface PhaseOption {
  value: string
  label: string
  bbch: string
  description: string
  group: string
}

export const PHASE_GROUPS = [
  { key: '0', label: '0 – Austrieb' },
  { key: '1', label: '1 – Blattentwicklung' },
  { key: '5', label: '5 – Blütenanlagen' },
  { key: '6', label: '6 – Blüte' },
  { key: '7', label: '7 – Fruchtentwicklung' },
  { key: '8', label: '8 – Fruchtreife' },
]

export const PHASE_OPTIONS: PhaseOption[] = [
  // 0 – Austrieb
  { value: 'Winterruhe',        label: 'Winterruhe',        bbch: 'BBCH 00',    description: 'Rebe im Winterschlaf, Knospen geschlossen',                         group: '0' },
  { value: 'Die Rebe weint',    label: 'Die Rebe weint',    bbch: 'BBCH 00–01', description: 'Wasserausfluss an Schnittstellen',                                  group: '0' },
  { value: 'Knospenschwellen',  label: 'Knospenschwellen',  bbch: 'BBCH 01',    description: 'Beginn des Knospenschwellens',                                      group: '0' },
  { value: 'Wolle-Stadium',     label: 'Wolle-Stadium',     bbch: 'BBCH 05',    description: 'Wollige Hüllblätter sichtbar',                                      group: '0' },
  { value: 'Knospenaufbruch',   label: 'Knospenaufbruch',   bbch: 'BBCH 09',    description: 'Grüne Triebspitzen sichtbar (grüne Spitze)',                        group: '0' },
  // 1 – Blattentwicklung
  { value: '1 Blatt',           label: '1 Blatt entfaltet', bbch: 'BBCH 10',    description: '1. Blatt entfaltet, entspricht meistens Stad. 53',                  group: '1' },
  { value: '2 Blätter',         label: '2 Blätter',         bbch: 'BBCH 12',    description: '2 Blätter entfaltet',                                               group: '1' },
  { value: '3 Blätter',         label: '3 Blätter',         bbch: 'BBCH 13',    description: '3 Blätter entfaltet',                                               group: '1' },
  { value: '4 Blätter',         label: '4 Blätter',         bbch: 'BBCH 14',    description: '4 Blätter entfaltet, Gescheine meistens Stad. 53',                  group: '1' },
  // 5 – Blütenanlagen
  { value: 'Gescheine sichtbar',  label: 'Gescheine sichtbar',  bbch: 'BBCH 53', description: 'Gescheine deutlich sichtbar',                                      group: '5' },
  { value: 'Gescheine wachsen',   label: 'Gescheine wachsen',   bbch: 'BBCH 55', description: 'Gescheine vergrössern sich',                                        group: '5' },
  { value: 'Einzelblüten',        label: 'Einzelblüten spreizen', bbch: 'BBCH 57', description: 'Einzelblüten beginnen sich zu spreizen',                          group: '5' },
  // 6 – Blüte
  { value: 'Blütebeginn',       label: 'Blütebeginn',       bbch: 'BBCH 61',    description: 'Beginn der Blüte',                                                  group: '6' },
  { value: 'Vollblüte',         label: 'Vollblüte',         bbch: 'BBCH 65',    description: '50% der Blütenköppchen abgeworfen (wichtigster Zeitpunkt)',          group: '6' },
  { value: 'Blüteende',         label: 'Blüteende',         bbch: 'BBCH 67–69', description: 'Ende der Blüte',                                                   group: '6' },
  // 7 – Fruchtentwicklung
  { value: 'Fruchtansatz',      label: 'Fruchtansatz',      bbch: 'BBCH 71',    description: 'Beeren beginnen sich zu entwickeln',                               group: '7' },
  { value: 'Schrotkorn',        label: 'Schrotkorngrösse',  bbch: 'BBCH 73',    description: 'Beeren haben Schrotkorngrösse',                                     group: '7' },
  { value: 'Erbsengrösse',      label: 'Erbsengrösse',      bbch: 'BBCH 75',    description: 'Beeren haben Erbsengrösse, Trauben hängen',                        group: '7' },
  { value: 'Traubenschluss',    label: 'Traubenschluss',    bbch: 'BBCH 77',    description: 'Beginn des Traubenschlusses',                                      group: '7' },
  // 8 – Fruchtreife
  { value: 'Reifebeginn',       label: 'Reifebeginn / Véraison', bbch: 'BBCH 81', description: 'Beginn der Reife, Beerenfarbe verändert sich',                   group: '8' },
  { value: 'Weichwerden',       label: 'Weichwerden',       bbch: 'BBCH 83–85', description: 'Beeren werden weich',                                              group: '8' },
  { value: 'Vollreife',         label: 'Vollreife',         bbch: 'BBCH 89',    description: 'Trauben erntereif',                                                group: '8' },
]

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  offen:    'Offen',
  erledigt: 'Erledigt',
}

export const TASK_STATUS_NEXT: Record<TaskStatus, TaskStatus | null> = {
  offen:    'erledigt',
  erledigt: null,
}

export const TASK_STATUS_NEXT_LABEL: Record<TaskStatus, string> = {
  offen:    '✓ Erledigt',
  erledigt: '',
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
