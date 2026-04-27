import { useEffect, useState } from 'react'
import {
  Box, Typography, CircularProgress, Alert, Tabs, Tab,
} from '@mui/material'
import type { Vineyard } from '../../types'
import { usePersonalStore } from '../../store/personalStore'
import TimeEntrySection from './TimeEntrySection'
import YearStats from './YearStats'
import ManageSection from './ManageSection'

interface Props {
  vineyard: Vineyard | null
}

export default function PersonalPage({ vineyard }: Props) {
  const [tab, setTab] = useState(0)
  const { loading, error, loadAll } = usePersonalStore()

  useEffect(() => { loadAll() }, [loadAll])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 2, pt: 2, pb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Personal</Typography>
      </Box>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="fullWidth"
        sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 36 }}
      >
        <Tab label="Stunden" sx={{ minHeight: 36, fontSize: '0.7rem' }} />
        <Tab label="Auswertung" sx={{ minHeight: 36, fontSize: '0.7rem' }} />
        <Tab label="Verwaltung" sx={{ minHeight: 36, fontSize: '0.7rem' }} />
      </Tabs>

      {error && <Alert severity="error" sx={{ mx: 2, mt: 1 }}>{error}</Alert>}
      {loading && <CircularProgress size={24} sx={{ alignSelf: 'center', my: 2 }} />}

      {!loading && (
        <>
          {tab === 0 && <TimeEntrySection vineyard={vineyard} />}
          {tab === 1 && <YearStats />}
          {tab === 2 && <ManageSection />}
        </>
      )}
    </Box>
  )
}
