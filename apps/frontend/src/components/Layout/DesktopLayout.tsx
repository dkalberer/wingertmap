import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  ListSubheader, Divider, Typography,
} from '@mui/material'

const APPBAR_HEIGHT = 48
const NAV_WIDTH = 180
const PANEL_WIDTH = 320

export interface NavItem {
  index: number
  label: string
  icon: React.ReactNode
}

interface Props {
  activeTab: number
  panelOpen: boolean
  panelLabel: string
  panelContent: React.ReactNode
  nutzungItems: NavItem[]
  analyseItems: NavItem[]
  einstellungenItems: NavItem[]
  children: React.ReactNode
  onNavClick: (index: number) => void
}

export default function DesktopLayout({
  activeTab, panelOpen, panelLabel, panelContent,
  nutzungItems, analyseItems, einstellungenItems, children, onNavClick,
}: Props) {
  return (
    <>
      <Drawer
        variant="permanent"
        sx={{
          width: NAV_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: NAV_WIDTH,
            boxSizing: 'border-box',
            top: `${APPBAR_HEIGHT}px`,
            height: `calc(100% - ${APPBAR_HEIGHT}px)`,
            overflow: 'auto',
            borderRight: 'none',
          },
        }}
      >
        <List dense disablePadding sx={{ px: 0.5, pt: 0.5 }}>
          <ListSubheader sx={{ lineHeight: '32px', bgcolor: 'transparent' }}>Nutzung</ListSubheader>
          {nutzungItems.map(({ index, label, icon }) => (
            <ListItemButton
              key={index}
              selected={activeTab === index}
              onClick={() => onNavClick(index)}
              title={panelOpen && activeTab === index ? `${label} zuklappen` : label}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>{icon}</ListItemIcon>
              <ListItemText primary={label} />
            </ListItemButton>
          ))}
          <Divider sx={{ my: 0.5 }} />
          <ListSubheader sx={{ lineHeight: '32px', bgcolor: 'transparent' }}>Analyse</ListSubheader>
          {analyseItems.map(({ index, label, icon }) => (
            <ListItemButton
              key={index}
              selected={activeTab === index}
              onClick={() => onNavClick(index)}
              title={panelOpen && activeTab === index ? `${label} zuklappen` : label}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>{icon}</ListItemIcon>
              <ListItemText primary={label} />
            </ListItemButton>
          ))}
          <Divider sx={{ my: 0.5 }} />
          <ListSubheader sx={{ lineHeight: '32px', bgcolor: 'transparent' }}>Einstellungen</ListSubheader>
          {einstellungenItems.map(({ index, label, icon }) => (
            <ListItemButton
              key={index}
              selected={activeTab === index}
              onClick={() => onNavClick(index)}
              title={panelOpen && activeTab === index ? `${label} zuklappen` : label}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>{icon}</ListItemIcon>
              <ListItemText primary={label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      {/* In-flow spacer — pushes map right as panel opens */}
      <Box sx={{ width: panelOpen ? PANEL_WIDTH : 0, flexShrink: 0, transition: 'width 0.2s ease' }} />

      {/* Fixed visual panel */}
      <Box
        sx={{
          position: 'fixed',
          left: NAV_WIDTH,
          top: APPBAR_HEIGHT,
          width: panelOpen ? PANEL_WIDTH : 0,
          height: `calc(100% - ${APPBAR_HEIGHT}px)`,
          overflow: 'hidden',
          transition: 'width 0.2s ease',
          zIndex: (t) => t.zIndex.drawer - 1,
          bgcolor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ px: 2, py: 0.75, bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
          <Typography variant="overline" color="text.secondary" component="p" sx={{ lineHeight: 1 }}>
            {panelLabel}
          </Typography>
        </Box>
        {panelContent}
      </Box>

      {/* Map area */}
      {children}
    </>
  )
}
