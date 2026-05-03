import {
  Box, SwipeableDrawer, BottomNavigation, BottomNavigationAction,
  Fab, Badge, Button,
} from '@mui/material'
import ForestIcon from '@mui/icons-material/Forest'
import ListAltIcon from '@mui/icons-material/ListAlt'
import BarChartIcon from '@mui/icons-material/BarChart'
import SettingsIcon from '@mui/icons-material/Settings'
import AddIcon from '@mui/icons-material/Add'

interface Props {
  activeTab: number
  sheetOpen: boolean
  sheetContent: React.ReactNode
  taskBadgeCount: number
  children: React.ReactNode
  onTabChange: (tab: number) => void
  onSheetOpenChange: (open: boolean) => void
  onFABPress: () => void
}

export default function MobileLayout({
  activeTab, sheetOpen, sheetContent, taskBadgeCount,
  children, onTabChange, onSheetOpenChange, onFABPress,
}: Props) {
  // Tabs 3+ map to the Einstellungen bottom nav item (index 3)
  const bottomNavValue = activeTab >= 3 ? 3 : activeTab

  function handleNavChange(_: React.SyntheticEvent, newValue: number) {
    if (newValue === 3) {
      const settingsTab = activeTab >= 3 ? activeTab : 3
      if (sheetOpen && activeTab >= 3) {
        onSheetOpenChange(false)
      } else {
        onTabChange(settingsTab)
        onSheetOpenChange(true)
      }
    } else {
      if (sheetOpen && newValue === activeTab) {
        onSheetOpenChange(false)
      } else {
        onTabChange(newValue)
        onSheetOpenChange(true)
      }
    }
  }

  return (
    <>
      <SwipeableDrawer
        anchor="bottom"
        open={sheetOpen}
        onOpen={() => onSheetOpenChange(true)}
        onClose={() => onSheetOpenChange(false)}
        swipeAreaWidth={0}
        disableSwipeToOpen
        ModalProps={{ keepMounted: true }}
        sx={{
          '& .MuiDrawer-paper': {
            height: 'calc(70vh - 56px - env(safe-area-inset-bottom))',
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            bottom: 'calc(56px + env(safe-area-inset-bottom))',
            top: 'auto',
          },
        }}
      >
        {/* Drag handle */}
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1, pb: 0.5, flexShrink: 0 }}>
          <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'divider' }} />
        </Box>

        {/* Einstellungen sub-navigation */}
        {activeTab >= 3 && (
          <Box sx={{ display: 'flex', px: 2, pb: 1, gap: 1, flexShrink: 0 }}>
            <Button size="small" variant={activeTab === 3 ? 'contained' : 'outlined'} onClick={() => onTabChange(3)} sx={{ flex: 1, minHeight: 36 }}>
              Sorten
            </Button>
            <Button size="small" variant={activeTab === 4 ? 'contained' : 'outlined'} onClick={() => onTabChange(4)} sx={{ flex: 1, minHeight: 36 }}>
              Personal
            </Button>
            <Button size="small" variant={activeTab === 5 ? 'contained' : 'outlined'} onClick={() => onTabChange(5)} sx={{ flex: 1, minHeight: 36 }}>
              Tätigkeiten
            </Button>
          </Box>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {sheetContent}
        </Box>
      </SwipeableDrawer>

      {/* Map area */}
      {children}

      {/* FAB — opens quick action sheet */}
      <Fab
        color="primary"
        aria-label="Neu erfassen"
        onClick={onFABPress}
        sx={{
          position: 'fixed',
          bottom: 'calc(72px + env(safe-area-inset-bottom))',
          right: 16,
          zIndex: 1050,
        }}
      >
        <AddIcon />
      </Fab>

      {/* Bottom navigation — 5 items */}
      <BottomNavigation
        value={bottomNavValue}
        onChange={handleNavChange}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          borderTop: 1,
          borderColor: 'divider',
          height: 'calc(56px + env(safe-area-inset-bottom))',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <BottomNavigationAction label="Weinberge" icon={<ForestIcon />} />
        <BottomNavigationAction
          label="Aufgaben"
          icon={
            <Badge badgeContent={taskBadgeCount} color="error" max={99}>
              <ListAltIcon />
            </Badge>
          }
        />
        <BottomNavigationAction label="Auswertungen" icon={<BarChartIcon />} />
        <BottomNavigationAction
          label="Einstellungen"
          icon={
            <Badge variant="dot" invisible={activeTab < 4} color="primary">
              <SettingsIcon />
            </Badge>
          }
        />
      </BottomNavigation>
    </>
  )
}
