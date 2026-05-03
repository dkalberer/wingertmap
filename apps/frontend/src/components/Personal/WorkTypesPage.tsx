import { useEffect } from 'react'
import { Box, CircularProgress, Alert } from '@mui/material'
import { usePersonalStore } from '../../store/personalStore'
import ManageSection from './ManageSection'

export default function WorkTypesPage() {
  const { loading, error, loadAll } = usePersonalStore()

  useEffect(() => { loadAll() }, [loadAll])

  if (loading) return <CircularProgress size={24} sx={{ m: 2 }} />
  if (error) return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>

  return (
    <Box sx={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
      <ManageSection section="workTypes" />
    </Box>
  )
}
