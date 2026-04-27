import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import TaskList from './TaskList'
import type { Task } from '../../types'

const tasks: Task[] = [
  { id: 't1', vineId: 'v1', title: 'Beschnitt', recordType: 'aufgabe', category: 'rebenpflege', status: 'offen', createdAt: '2024-01-01T00:00:00Z' },
  { id: 't2', vineId: 'v1', title: 'Ernte', recordType: 'aufgabe', category: 'sonstiges', status: 'erledigt', createdAt: '2024-01-01T00:00:00Z' },
]

describe('TaskList', () => {
  it('renders all tasks with translated labels', () => {
    render(<TaskList tasks={tasks} onStatusChange={vi.fn()} onSelect={vi.fn()} />)
    // titles appear as "✂️ Beschnitt" / "🍇 Ernte" inside the h6 — use partial match
    expect(screen.getByText(/Beschnitt/)).toBeInTheDocument()
    // erledigt group header is rendered even if collapsed
    expect(screen.getAllByText(/Erledigt/i).length).toBeGreaterThan(0)
  })

  it('shows empty state when no tasks', () => {
    render(<TaskList tasks={[]} onStatusChange={vi.fn()} onSelect={vi.fn()} />)
    expect(screen.getByText(/keine aufgaben/i)).toBeInTheDocument()
  })
})
