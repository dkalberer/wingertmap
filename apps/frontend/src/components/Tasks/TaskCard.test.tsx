import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import TaskCard from './TaskCard'
import type { Task } from '../../types'

const mockTask: Task = {
  id: 'task-1',
  vineId: 'vine-1',
  title: 'Beschnitt',
  recordType: 'aufgabe',
  category: 'rebenpflege',
  status: 'offen',
  notes: 'Schnitt notwendig',
  createdAt: '2024-01-01T00:00:00Z',
}

describe('TaskCard', () => {
  it('renders translated task type and status', () => {
    render(<TaskCard task={mockTask} onStatusChange={vi.fn()} />)
    expect(screen.getByText(/Beschnitt/i)).toBeInTheDocument()
    expect(screen.getByText(/Offen/i)).toBeInTheDocument()
  })

  it('renders task notes', () => {
    render(<TaskCard task={mockTask} onStatusChange={vi.fn()} />)
    expect(screen.getByText('Schnitt notwendig')).toBeInTheDocument()
  })

  it('calls onStatusChange when status button clicked', () => {
    const onStatusChange = vi.fn()
    render(<TaskCard task={mockTask} onStatusChange={onStatusChange} />)
    fireEvent.click(screen.getByRole('button', { name: /erledigt/i }))
    expect(onStatusChange).toHaveBeenCalledWith('task-1', 'erledigt')
  })
})
