import { Box, SwipeableDrawer, ButtonBase, Typography, Divider } from '@mui/material'
import AssignmentIcon from '@mui/icons-material/Assignment'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import AgricultureIcon from '@mui/icons-material/Agriculture'
import ContentCutIcon from '@mui/icons-material/ContentCut'
import PentagonIcon from '@mui/icons-material/Pentagon'
import TimelineIcon from '@mui/icons-material/Timeline'

interface Action {
  icon: React.ReactNode
  label: string
  description: string
  disabled?: boolean
  onClick: () => void
}

interface Props {
  open: boolean
  hasVineyard: boolean
  onClose: () => void
  onCreateTask: () => void
  onLogHours: () => void
  onLogHarvest: () => void
  onLogPruning: () => void
  onDrawVineyard: () => void
  onDrawRow: () => void
}

export default function QuickActionSheet({
  open, hasVineyard, onClose,
  onCreateTask, onLogHours, onLogHarvest, onLogPruning, onDrawVineyard, onDrawRow,
}: Props) {
  const actions: Action[] = [
    {
      icon: <AssignmentIcon sx={{ fontSize: 28, color: 'primary.main' }} />,
      label: 'Aufgabe erstellen',
      description: 'Aufgabe oder Beobachtung erfassen',
      onClick: () => { onClose(); onCreateTask() },
    },
    {
      icon: <AccessTimeIcon sx={{ fontSize: 28, color: 'secondary.main' }} />,
      label: 'Stunden erfassen',
      description: 'Arbeitszeit eintragen',
      onClick: () => { onClose(); onLogHours() },
    },
    {
      icon: <AgricultureIcon sx={{ fontSize: 28, color: 'success.main' }} />,
      label: 'Ernte erfassen',
      description: 'Ernteeintrag hinzufügen',
      onClick: () => { onClose(); onLogHarvest() },
    },
    {
      icon: <ContentCutIcon sx={{ fontSize: 28, color: 'warning.main' }} />,
      label: 'Rebschnitt erfassen',
      description: 'Schnittdaten eintragen',
      onClick: () => { onClose(); onLogPruning() },
    },
    {
      icon: <PentagonIcon sx={{ fontSize: 28, color: 'info.main' }} />,
      label: 'Wingert zeichnen',
      description: 'Neue Wingertfläche auf Karte einzeichnen',
      onClick: () => { onClose(); onDrawVineyard() },
    },
    {
      icon: <TimelineIcon sx={{ fontSize: 28, color: hasVineyard ? 'warning.main' : 'action.disabled' }} />,
      label: 'Reihe zeichnen',
      description: hasVineyard ? 'Neue Reihe in ausgewähltem Wingert' : 'Zuerst Wingert auswählen',
      disabled: !hasVineyard,
      onClick: () => { onClose(); onDrawRow() },
    },
  ]

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
          pb: 'env(safe-area-inset-bottom)',
        },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5, pb: 1 }}>
        <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'divider' }} />
      </Box>

      <Typography variant="overline" color="text.secondary" sx={{ px: 2, pb: 1, display: 'block' }}>
        Neu erfassen
      </Typography>

      {actions.map((action, i) => (
        <Box key={action.label}>
          {i > 0 && <Divider sx={{ mx: 2 }} />}
          <ButtonBase
            onClick={action.onClick}
            disabled={action.disabled}
            sx={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 2,
              px: 2,
              py: 1.75,
              textAlign: 'left',
              opacity: action.disabled ? 0.45 : 1,
              '&:hover:not(:disabled)': { bgcolor: 'action.hover' },
              '&:active:not(:disabled)': { bgcolor: 'action.selected' },
            }}
          >
            <Box sx={{
              width: 48, height: 48, borderRadius: 2,
              bgcolor: action.disabled ? 'action.disabledBackground' : 'action.hover',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {action.icon}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 600, lineHeight: 1.3, color: action.disabled ? 'text.disabled' : 'text.primary' }}>
                {action.label}
              </Typography>
              <Typography variant="caption" color={action.disabled ? 'text.disabled' : 'text.secondary'}>
                {action.description}
              </Typography>
            </Box>
          </ButtonBase>
        </Box>
      ))}

      <Box sx={{ pb: 2 }} />
    </SwipeableDrawer>
  )
}
