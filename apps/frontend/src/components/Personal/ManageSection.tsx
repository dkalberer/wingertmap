import { useState } from 'react'
import {
  Box, Typography, IconButton, List, ListItem, ListItemText,
  TextField, Button, Divider, Popover, Alert,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import { usePersonalStore } from '../../store/personalStore'

const SEED_WORK_TYPES = ['Rebschnitt', 'Erlesen', 'Lauben', 'Sonstiges']

interface Props {
  section?: 'employees' | 'workTypes'
}

export default function ManageSection({ section }: Props) {
  const { employees, workTypes, createEmployee, removeEmployee, createWorkType, removeWorkType } = usePersonalStore()
  const [newEmployee, setNewEmployee] = useState('')
  const [newWorkType, setNewWorkType] = useState('')
  const [deleteAnchor, setDeleteAnchor] = useState<{ el: HTMLElement; id: string; type: 'employee' | 'worktype' } | null>(null)

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

  async function handleDelete() {
    if (!deleteAnchor) return
    if (deleteAnchor.type === 'employee') await removeEmployee(deleteAnchor.id)
    else await removeWorkType(deleteAnchor.id)
    setDeleteAnchor(null)
  }

  const showEmployees = !section || section === 'employees'
  const showWorkTypes = !section || section === 'workTypes'

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>

      {showEmployees && (
        <>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Mitarbeiter</Typography>

          {employees.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Noch keine Mitarbeiter erfasst.</Typography>
          ) : (
            <List dense disablePadding>
              {employees.map((e, i) => (
                <Box key={e.id}>
                  {i > 0 && <Divider />}
                  <ListItem
                    disableGutters
                    secondaryAction={
                      <IconButton
                        size="small"
                        onClick={(ev) => setDeleteAnchor({ el: ev.currentTarget, id: e.id, type: 'employee' })}
                        sx={{ color: 'error.main', minWidth: 44, minHeight: 44 }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemText primary={<Typography variant="body2">{e.name}</Typography>} />
                  </ListItem>
                </Box>
              ))}
            </List>
          )}

          <Box component="form" onSubmit={(ev) => { ev.preventDefault(); handleAddEmployee() }}
            sx={{ display: 'flex', gap: 1 }}
          >
            <TextField
              size="small"
              placeholder="Name"
              value={newEmployee}
              onChange={(e) => setNewEmployee(e.target.value)}
              sx={{ flex: 1 }}
            />
            <Button size="small" variant="outlined" startIcon={<AddIcon />} type="submit" sx={{ minHeight: 40 }}>
              Hinzufügen
            </Button>
          </Box>
        </>
      )}

      {showEmployees && showWorkTypes && <Divider />}

      {showWorkTypes && (
        <>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Tätigkeiten</Typography>

          {workTypes.length === 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary">Vorschläge: </Typography>
              {SEED_WORK_TYPES.map((name) => (
                <Button key={name} size="small" variant="text" sx={{ mr: 0.5, fontSize: '0.75rem' }} onClick={() => handleAddWorkType(name)}>
                  + {name}
                </Button>
              ))}
            </Box>
          )}

          {workTypes.length > 0 && (
            <List dense disablePadding>
              {workTypes.map((wt, i) => (
                <Box key={wt.id}>
                  {i > 0 && <Divider />}
                  <ListItem
                    disableGutters
                    secondaryAction={
                      <IconButton
                        size="small"
                        onClick={(ev) => setDeleteAnchor({ el: ev.currentTarget, id: wt.id, type: 'worktype' })}
                        sx={{ color: 'error.main', minWidth: 44, minHeight: 44 }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemText primary={<Typography variant="body2">{wt.name}</Typography>} />
                  </ListItem>
                </Box>
              ))}
            </List>
          )}

          <Box component="form" onSubmit={(ev) => { ev.preventDefault(); handleAddWorkType(newWorkType) }}
            sx={{ display: 'flex', gap: 1 }}
          >
            <TextField
              size="small"
              placeholder="z.B. Pikieren"
              value={newWorkType}
              onChange={(e) => setNewWorkType(e.target.value)}
              sx={{ flex: 1 }}
            />
            <Button size="small" variant="outlined" startIcon={<AddIcon />} type="submit" sx={{ minHeight: 40 }}>
              Hinzufügen
            </Button>
          </Box>
        </>
      )}

      {/* Shared delete confirmation popover */}
      <Popover
        open={!!deleteAnchor}
        anchorEl={deleteAnchor?.el}
        onClose={() => setDeleteAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Alert severity="warning" sx={{ py: 0 }}>
            {deleteAnchor?.type === 'employee' ? 'Mitarbeiter löschen?' : 'Tätigkeit löschen?'}
          </Alert>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" color="error" variant="contained" onClick={handleDelete} sx={{ minHeight: 44, flex: 1 }}>
              Löschen
            </Button>
            <Button size="small" variant="outlined" onClick={() => setDeleteAnchor(null)} sx={{ minHeight: 44, flex: 1 }}>
              Abbrechen
            </Button>
          </Box>
        </Box>
      </Popover>

    </Box>
  )
}
