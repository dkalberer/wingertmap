import { useState } from 'react'
import {
  Box, Typography, IconButton, List, ListItem, ListItemText,
  TextField, Button, Divider,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import { usePersonalStore } from '../../store/personalStore'

const SEED_WORK_TYPES = ['Rebschnitt', 'Erlesen', 'Lauben', 'Sonstiges']

export default function ManageSection() {
  const { employees, workTypes, createEmployee, removeEmployee, createWorkType, removeWorkType } = usePersonalStore()
  const [newEmployee, setNewEmployee] = useState('')
  const [newWorkType, setNewWorkType] = useState('')

  async function handleAddEmployee() {
    const name = newEmployee.trim()
    if (!name) return
    await createEmployee(name)
    setNewEmployee('')
  }

  async function handleAddWorkType(name: string) {
    const n = name.trim()
    if (!n) return
    await createWorkType(n)
    setNewWorkType('')
  }

  return (
    <Box sx={{ px: 2, py: 1.5 }}>
      {/* Mitarbeiter */}
      <Typography variant="overline" color="text.secondary">Mitarbeiter</Typography>
      <List dense disablePadding sx={{ maxHeight: 160, overflow: 'auto' }}>
        {employees.map((e) => (
          <ListItem
            key={e.id}
            disableGutters
            secondaryAction={
              <IconButton edge="end" size="small" onClick={() => removeEmployee(e.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            }
          >
            <ListItemText primary={e.name} />
          </ListItem>
        ))}
      </List>
      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
        <TextField
          size="small"
          placeholder="Name"
          value={newEmployee}
          onChange={(e) => setNewEmployee(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddEmployee()}
          sx={{ flex: 1 }}
        />
        <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={handleAddEmployee}>
          Hinzufügen
        </Button>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Tätigkeitstypen */}
      <Typography variant="overline" color="text.secondary">Tätigkeitstypen</Typography>
      {workTypes.length === 0 && (
        <Box sx={{ mt: 0.5, mb: 1 }}>
          <Typography variant="caption" color="text.secondary">Vorschläge: </Typography>
          {SEED_WORK_TYPES.map((name) => (
            <Button key={name} size="small" variant="text" sx={{ mr: 0.5, fontSize: '0.75rem' }} onClick={() => handleAddWorkType(name)}>
              + {name}
            </Button>
          ))}
        </Box>
      )}
      <List dense disablePadding sx={{ maxHeight: 200, overflow: 'auto' }}>
        {workTypes.map((wt) => (
          <ListItem
            key={wt.id}
            disableGutters
            secondaryAction={
              <IconButton edge="end" size="small" onClick={() => removeWorkType(wt.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            }
          >
            <ListItemText primary={wt.name} />
          </ListItem>
        ))}
      </List>
      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
        <TextField
          size="small"
          placeholder="z.B. Pikieren"
          value={newWorkType}
          onChange={(e) => setNewWorkType(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddWorkType(newWorkType)}
          sx={{ flex: 1 }}
        />
        <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => handleAddWorkType(newWorkType)}>
          Hinzufügen
        </Button>
      </Box>
    </Box>
  )
}
