import { useEffect, useState } from 'react'
import {
  Box, Typography, CircularProgress, Alert, Button, Divider,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import type { Vineyard } from '../../types'
import { useHarvestStore } from '../../store/harvestStore'
import HarvestForm from './HarvestForm'
import HarvestList from './HarvestList'
import HarvestCharts from './HarvestCharts'

interface Props {
  vineyard: Vineyard | null
}

export default function HarvestPage({ vineyard }: Props) {
  const { harvests, loading, error, load, create, remove, vineyardId } = useHarvestStore()
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    if (vineyard && vineyard.id !== vineyardId) {
      load(vineyard.id)
      setShowForm(false)
    }
  }, [vineyard?.id, vineyardId, load, vineyard])

  if (!vineyard) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Bitte zuerst einen Wingert im Tab "Weinberge" auswählen.
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 2, pt: 2, pb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Ernte · {vineyard.name}
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mx: 2, mb: 1 }}>{error}</Alert>}
      {loading && <CircularProgress size={24} sx={{ alignSelf: 'center', my: 2 }} />}

      {!loading && (
        <>
          <HarvestList
            harvests={harvests}
            onDelete={remove}
          />

          <Divider sx={{ my: 1 }} />

          {showForm ? (
            <Box sx={{ px: 2, pb: 2 }}>
              <HarvestForm
                vineyardId={vineyard.id}
                onSubmit={async (params) => {
                  await create(vineyard.id, params)
                  setShowForm(false)
                }}
                onCancel={() => setShowForm(false)}
              />
            </Box>
          ) : (
            <Box sx={{ px: 2, pb: 2 }}>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setShowForm(true)}
                sx={{ minHeight: 44 }}
              >
                Ernteeintrag hinzufügen
              </Button>
            </Box>
          )}

          {harvests.length > 1 && (
            <>
              <Divider />
              <HarvestCharts harvests={harvests} />
              <Box sx={{ pb: 2 }} />
            </>
          )}
        </>
      )}
    </Box>
  )
}
