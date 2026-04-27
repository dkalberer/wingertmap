import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import {
  Box, AppBar, Toolbar, Typography, IconButton,
  Divider, Dialog, DialogTitle, DialogContent,
  Drawer, SwipeableDrawer, useMediaQuery, useTheme,
  Badge, List, ListItemButton, ListItemIcon, ListItemText, ListSubheader,
  BottomNavigation, BottomNavigationAction, Button,
  Snackbar, Alert,
} from '@mui/material'
import LogoutIcon from '@mui/icons-material/Logout'
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts'
import ListAltIcon from '@mui/icons-material/ListAlt'
import ForestIcon from '@mui/icons-material/Forest'
import GrapeIcon from '@mui/icons-material/Spa'
import AgricultureIcon from '@mui/icons-material/Agriculture'
import PeopleIcon from '@mui/icons-material/People'
import { useAuthStore } from './store/authStore'
import { useMapStore } from './store/mapStore'
import { useVineyardStore } from './store/vineyardStore'
import { useTaskStore } from './store/taskStore'
import LoginForm from './components/Auth/LoginForm'
import ChangePasswordForm from './components/Auth/ChangePasswordForm'
import VineyardList from './components/Vineyard/VineyardList'
import VineyardDetail from './components/Vineyard/VineyardDetail'
import VineyardForm from './components/Vineyard/VineyardForm'
import VineyardMap from './components/Map/VineyardMap'
import GlobalTasksPanel from './components/Tasks/GlobalTasksPanel'
import VarietyManager from './components/Varieties/VarietyManager'
import HarvestPage from './components/Harvest/HarvestPage'
import PersonalPage from './components/Personal/PersonalPage'
import type { Vineyard, GeoJSONPolygon, GeoJSONLineString, GeoJSONPoint, Task } from './types'
import { polygonCenter } from './utils/geo'

const DRAWER_WIDTH = 300

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

function MainLayout() {
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const hydrate = useAuthStore((s) => s.hydrate)

  useEffect(() => { hydrate() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const { setCenter, setZoom } = useMapStore()
  const { vineyards } = useVineyardStore()
  const { tasks, loading: tasksLoading, error: tasksError, load: loadTasks, create: createTask, changeStatus, remove: removeTask, notification, clearNotification } = useTaskStore()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [selected, setSelected] = useState<Vineyard | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [changePwOpen, setChangePwOpen] = useState(false)
  const [pendingBoundary, setPendingBoundary] = useState<GeoJSONPolygon | null>(null)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [drawerTab, setDrawerTab] = useState(0) // 0 = Weinberge, 1 = Aufgaben
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const [pickingLocation, setPickingLocation] = useState(false)
  const [pendingLocation, setPendingLocation] = useState<GeoJSONPoint | null>(null)
  const flyToRef = useRef<((lat: number, lng: number, zoom?: number) => void) | null>(null)
  const hasAutoSelected = useRef(false)

  useEffect(() => { loadTasks() }, [loadTasks])

  useEffect(() => {
    if (selected && vineyards.length > 0 && !vineyards.find(v => v.id === selected.id)) {
      setSelected(null)
    }
  }, [vineyards, selected])

  useEffect(() => {
    if (hasAutoSelected.current || vineyards.length === 0) return
    const favId = localStorage.getItem('favoriteVineyardId')
    if (!favId) return
    const fav = vineyards.find(v => v.id === favId)
    if (fav) {
      hasAutoSelected.current = true
      selectVineyard(fav)
    }
  }, [vineyards]) // eslint-disable-line react-hooks/exhaustive-deps

  function selectVineyard(v: Vineyard) {
    setSelected(v)
    if (v.boundary) {
      setCenter(polygonCenter(v.boundary))
      setZoom(17)
    }
    if (isMobile) setMobileDrawerOpen(false)
  }

  function handleDrawComplete(geometry: GeoJSONPolygon | GeoJSONLineString) {
    if (geometry.type !== 'Polygon') return
    setPendingBoundary(geometry as GeoJSONPolygon)
    setAddOpen(true)
  }

  function handleLocationPicked(p: GeoJSONPoint) {
    setPickingLocation(false)
    setPendingLocation(p)
    if (isMobile) {
      setDrawerTab(1)
      setMobileDrawerOpen(true)
    }
  }

  function handleLocateTask(task: Task) {
    if (!task.location) return
    const [lng, lat] = task.location.coordinates
    if (task.vineyardId) {
      const v = vineyards.find((v) => v.id === task.vineyardId)
      if (v) setSelected(v)
    }
    flyToRef.current?.(lat, lng, 20)
    if (isMobile) setMobileDrawerOpen(false)
    setSelectedTask(null)
  }

  function handleTaskSelect(task: Task | null) {
    setSelectedTask(task)
    if (task) {
      setDrawerTab(1)
      if (isMobile) setMobileDrawerOpen(true)
    }
  }

  async function handleCreateTask(params: Parameters<typeof createTask>[0]) {
    const task = await createTask({ ...params, vineyardId: selected?.id })
    setPendingLocation(null)
    return task
  }

  function handleStartPicking() {
    setPickingLocation(true)
    if (isMobile) setMobileDrawerOpen(false)
  }

  const openTaskCount = tasks.filter((t) => t.status !== 'erledigt').length

  const nutzungItems = [
    { index: 0, label: 'Weinberge', icon: <ForestIcon fontSize="small" /> },
    { index: 1, label: 'Aufgaben', icon: <Badge badgeContent={openTaskCount} color="error" max={99}><ListAltIcon fontSize="small" /></Badge> },
    { index: 2, label: 'Ernte', icon: <AgricultureIcon fontSize="small" /> },
  ]
  const verwaltungItems = [
    { index: 3, label: 'Sorten', icon: <GrapeIcon fontSize="small" /> },
    { index: 4, label: 'Personal', icon: <PeopleIcon fontSize="small" /> },
  ]

  const tabContents: React.ReactNode[] = [
    <Box sx={{ overflow: 'auto', flex: 1 }}>
      <VineyardList onSelect={selectVineyard} />
      {selected && (
        <>
          <Divider />
          <VineyardDetail vineyard={selected} />
        </>
      )}
    </Box>,
    <Box sx={{ overflow: 'auto', flex: 1 }}>
      <GlobalTasksPanel
        tasks={tasks}
        loading={tasksLoading}
        error={tasksError}
        pendingLocation={pendingLocation}
        selectedTask={selectedTask}
        onStartPicking={handleStartPicking}
        onCancelPicking={() => { setPickingLocation(false); setPendingLocation(null) }}
        onGPSLocation={setPendingLocation}
        onCreate={handleCreateTask}
        onStatusChange={changeStatus}
        onDelete={removeTask}
        onLocate={handleLocateTask}
        onTaskSelect={handleTaskSelect}
      />
    </Box>,
    <Box sx={{ overflow: 'auto', flex: 1 }}>
      <HarvestPage vineyard={selected} />
    </Box>,
    <Box sx={{ overflow: 'auto', flex: 1 }}>
      <VarietyManager />
    </Box>,
    <Box sx={{ overflow: 'auto', flex: 1 }}>
      <PersonalPage vineyard={selected} />
    </Box>,
  ]

  // Desktop: vertical nav list + content
  const desktopDrawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <List dense disablePadding>
        <ListSubheader sx={{ lineHeight: '32px' }}>Nutzung</ListSubheader>
        {nutzungItems.map(({ index, label, icon }) => (
          <ListItemButton key={index} selected={drawerTab === index} onClick={() => setDrawerTab(index)}>
            <ListItemIcon sx={{ minWidth: 36 }}>{icon}</ListItemIcon>
            <ListItemText primary={label} />
          </ListItemButton>
        ))}
        <Divider sx={{ my: 0.5 }} />
        <ListSubheader sx={{ lineHeight: '32px' }}>Verwaltung</ListSubheader>
        {verwaltungItems.map(({ index, label, icon }) => (
          <ListItemButton key={index} selected={drawerTab === index} onClick={() => setDrawerTab(index)}>
            <ListItemIcon sx={{ minWidth: 36 }}>{icon}</ListItemIcon>
            <ListItemText primary={label} />
          </ListItemButton>
        ))}
      </List>
      <Divider />
      {tabContents[drawerTab]}
    </Box>
  )

  // Mobile bottom sheet: only content, nav is BottomNavigation
  const mobileDrawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {tabContents[drawerTab]}
    </Box>
  )

  const APPBAR_HEIGHT = 48

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar variant="dense">
          <Typography variant="h6" sx={{ flexGrow: 1 }}>Wingertmap</Typography>
          {user && !isMobile && (
            <Button
              variant="text"
              color="inherit"
              size="small"
              onClick={() => setChangePwOpen(true)}
              sx={{ mr: 1, opacity: 0.8, textTransform: 'none' }}
            >
              {user.name}
            </Button>
          )}
          {token && isMobile && (
            <IconButton color="inherit" size="small" onClick={() => setChangePwOpen(true)} title="Passwort ändern" sx={{ mr: 0.5 }}>
              <ManageAccountsIcon fontSize="small" />
            </IconButton>
          )}
          <IconButton color="inherit" onClick={logout} title="Abmelden">
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Desktop: permanent sidebar with vertical nav */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', top: `${APPBAR_HEIGHT}px` },
          }}
        >
          {desktopDrawerContent}
        </Drawer>
      )}

      {/* Mobile: swipeable bottom sheet (content only, nav via BottomNavigation) */}
      {isMobile && (
        <SwipeableDrawer
          anchor="bottom"
          open={mobileDrawerOpen}
          onOpen={() => setMobileDrawerOpen(true)}
          onClose={() => setMobileDrawerOpen(false)}
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
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1, pb: 0.5 }}>
            <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'divider' }} />
          </Box>
          {mobileDrawerContent}
        </SwipeableDrawer>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          pt: `${APPBAR_HEIGHT}px`,
          pb: isMobile ? 'calc(56px + env(safe-area-inset-bottom))' : 0,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          '--map-panel-bottom': isMobile
            ? 'calc(56px + env(safe-area-inset-bottom) + 20px)'
            : '20px',
        }}
      >
        <VineyardMap
          onDrawComplete={handleDrawComplete}
          selectedVineyardId={selected?.id}
          onVineyardClick={(v) => { selectVineyard(v); if (isMobile) setMobileDrawerOpen(false) }}
          tasks={tasks.filter((t) => t.status !== 'erledigt')}
          pickingLocation={pickingLocation}
          onLocationPicked={handleLocationPicked}
          onFlyTo={(handler) => { flyToRef.current = handler }}
          onTaskSelect={handleTaskSelect}
        />
      </Box>

      {/* Mobile: Bottom Navigation Bar */}
      {isMobile && (
        <BottomNavigation
          value={drawerTab}
          onChange={(_, newValue) => {
            if (mobileDrawerOpen && newValue === drawerTab) {
              setMobileDrawerOpen(false)
            } else {
              setDrawerTab(newValue)
              setMobileDrawerOpen(true)
            }
          }}
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
          {[...nutzungItems, ...verwaltungItems].map(({ index, label, icon }) => (
            <BottomNavigationAction key={index} label={label} icon={icon} />
          ))}
        </BottomNavigation>
      )}

      <Dialog open={changePwOpen} onClose={() => setChangePwOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Passwort ändern</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <ChangePasswordForm onSuccess={() => setChangePwOpen(false)} />
          </Box>
        </DialogContent>
      </Dialog>

      <Snackbar
        open={!!notification}
        autoHideDuration={3000}
        onClose={clearNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: isMobile ? 'calc(64px + env(safe-area-inset-bottom))' : 16 }}
      >
        <Alert onClose={clearNotification} severity={notification?.severity} variant="filled" sx={{ width: '100%' }}>
          {notification?.message}
        </Alert>
      </Snackbar>

      <Dialog open={addOpen} onClose={() => { setAddOpen(false); setPendingBoundary(null) }} maxWidth="xs" fullWidth>
        <DialogTitle>Neuer Wingert</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <VineyardForm
              boundary={pendingBoundary ?? undefined}
              onSuccess={(v) => { setAddOpen(false); setPendingBoundary(null); selectVineyard(v) }}
            />
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  )
}

function AuthPage() {
  const navigate = useNavigate()

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
      <Box sx={{ bgcolor: 'background.paper', p: 4, borderRadius: 2, boxShadow: 3, width: '100%', maxWidth: 400 }}>
        <Typography variant="h4" color="primary" gutterBottom>Wingertmap</Typography>
        <LoginForm onSuccess={() => navigate('/')} />
      </Box>
    </Box>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/*" element={<ProtectedRoute><MainLayout /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
