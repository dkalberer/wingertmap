import {
  SwipeableDrawer, Box, Typography, IconButton,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useVineyardStore } from '../../store/vineyardStore'
import { useHarvestStore } from '../../store/harvestStore'
import HarvestForm from '../Harvest/HarvestForm'
import type { Vineyard } from '../../types'

interface Props {
  open: boolean
  vineyard: Vineyard | null
  onClose: () => void
}

export default function QuickHarvestSheet({ open, vineyard, onClose }: Props) {
  const { vineyards } = useVineyardStore()
  const { create } = useHarvestStore()

  const target = vineyard ?? (vineyards.length === 1 ? vineyards[0] : null)

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onOpen={() => {}}
      onClose={onClose}
      disableSwipeToOpen
      sx={{
        '& .MuiDrawer-paper': {
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          px: 2,
          pb: 'max(env(safe-area-inset-bottom), 16px)',
        },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5, mb: 1 }}>
        <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'divider' }} />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>
          Ernte erfassen{target ? ` · ${target.name}` : ''}
        </Typography>
        <IconButton size="small" onClick={onClose} sx={{ minWidth: 44, minHeight: 44 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {!target ? (
        <Typography variant="body2" color="text.secondary" sx={{ pb: 2 }}>
          Bitte zuerst einen Wingert im Tab "Weinberge" auswählen.
        </Typography>
      ) : (
        <HarvestForm
          vineyardId={target.id}
          onSubmit={async (params) => {
            await create(target.id, params)
            onClose()
          }}
          onCancel={onClose}
        />
      )}
    </SwipeableDrawer>
  )
}
