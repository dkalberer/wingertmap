import { useState, useEffect } from 'react'
import { Box, Typography, Divider, CircularProgress, Alert, Button } from '@mui/material'
import type { Vineyard } from '../../types'
import { usePersonalStore } from '../../store/personalStore'
import { useHarvestStore } from '../../store/harvestStore'
import { usePruningStore } from '../../store/pruningStore'
import YearStats from '../Personal/YearStats'
import HarvestCharts from '../Harvest/HarvestCharts'
import HarvestList from '../Harvest/HarvestList'
import TimeEntrySection from '../Personal/TimeEntrySection'
import PruningCorrelationTable from '../Vineyard/PruningCorrelationTable'
import PruningSection from '../Vineyard/PruningSection'
import { useMobile } from '../../hooks/useMobile'

interface Props {
  vineyard: Vineyard | null
}

export default function AnalyticsPage({ vineyard }: Props) {
  const [subTab, setSubTab] = useState(0)
  const isMobile = useMobile()
  const { loading: personalLoading, loadAll } = usePersonalStore()
  const { harvests, loading: harvestLoading, error: harvestError, load: loadHarvests, remove, vineyardId } = useHarvestStore()
  const { records: pruningRecords, loading: pruningLoading, load: loadPruning, vineyardId: pruningVineyardId } = usePruningStore()

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    if (vineyard && vineyard.id !== vineyardId) loadHarvests(vineyard.id)
  }, [vineyard?.id, vineyardId, loadHarvests, vineyard])

  useEffect(() => {
    if (vineyard && vineyard.id !== pruningVineyardId) loadPruning(vineyard.id)
  }, [vineyard?.id, pruningVineyardId, loadPruning, vineyard])

  const tabs = [
    { label: 'Stunden' },
    { label: 'Ernte' },
    { label: 'Schnitt' },
  ]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

      <Box sx={{ display: 'flex', px: 2, pt: isMobile ? 0.5 : 1.5, pb: 1, gap: 1, flexShrink: 0 }}>
        {tabs.map((tab, i) => (
          <Button
            key={tab.label}
            size="small"
            variant={subTab === i ? 'contained' : 'outlined'}
            onClick={() => setSubTab(i)}
            sx={{ flex: 1, minHeight: 36 }}
          >
            {tab.label}
          </Button>
        ))}
      </Box>

      <Divider />

      {subTab === 0 && (
        <Box sx={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
          {personalLoading ? (
            <CircularProgress size={20} sx={{ m: 2 }} />
          ) : (
            <>
              <YearStats />
              <Divider sx={{ my: 1 }} />
              <TimeEntrySection vineyard={vineyard} readOnly />
            </>
          )}
        </Box>
      )}

      {subTab === 1 && (
        <Box sx={{ overflow: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {!vineyard ? (
            <Typography variant="body2" color="text.secondary" sx={{ px: 2, pt: 2 }}>
              Bitte zuerst einen Wingert im Tab "Weinberge" auswählen.
            </Typography>
          ) : harvestLoading ? (
            <CircularProgress size={20} sx={{ m: 2 }} />
          ) : (
            <>
              {harvestError && <Alert severity="error" sx={{ mx: 2, mt: 1 }}>{harvestError}</Alert>}

              {harvests.length >= 2 && (
                <>
                  <HarvestCharts harvests={harvests} />
                  <Divider sx={{ mt: 1, mb: 0 }} />
                </>
              )}

              <HarvestList harvests={harvests} onDelete={remove} />

              <Box sx={{ pb: 3 }} />
            </>
          )}
        </Box>
      )}

      {subTab === 2 && (
        <Box sx={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
          {!vineyard ? (
            <Typography variant="body2" color="text.secondary" sx={{ px: 2, pt: 2 }}>
              Bitte zuerst einen Wingert im Tab "Weinberge" auswählen.
            </Typography>
          ) : (
            <Box sx={{ px: 2, pt: 2 }}>
              {pruningLoading ? (
                <CircularProgress size={20} />
              ) : (pruningRecords.length > 0 || harvests.length > 0) ? (
                <>
                  <PruningCorrelationTable records={pruningRecords} harvests={harvests} />
                  <Divider sx={{ my: 2 }} />
                </>
              ) : null}
              <PruningSection vineyard={vineyard} />
              <Box sx={{ pb: 3 }} />
            </Box>
          )}
        </Box>
      )}

    </Box>
  )
}
