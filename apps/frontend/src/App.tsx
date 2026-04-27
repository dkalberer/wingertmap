import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import {
  Box, AppBar, Toolbar, Typography, IconButton,
  Divider, Dialog, DialogTitle, DialogContent,
  Drawer, SwipeableDrawer, useMediaQuery, useTheme, Fab,
  Tabs, Tab, Badge,
} from '@mui/material'
import LogoutIcon from '@mui/icons-material/Logout'
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
import RegisterForm from './components/Auth/RegisterForm'
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
  const { setCenter, setZoom } = useMapStore()
  const { vineyards } = useVineyardStore()
  const { tasks, loading: tasksLoading, error: tasksError, load: loadTasks, create: createTask, changeStatus, remove: removeTask } = useTaskStore()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [selected, setSelected] = useState<Vineyard | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [pendingBoundary, setPendingBoundary] = useState<GeoJSONPolygon | null>(null)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [drawerTab, setDrawerTab] = useState(0) // 0 = Weinberge, 1 = Aufgaben

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

  const vineyardTabContent = (
    <Box sx={{ overflow: 'auto', flex: 1 }}>
      <VineyardList onSelect={selectVineyard} />
      <Divider />
      <Box sx={{ p: 1 }}>
        <Typography
          variant="caption"
          sx={{ cursor: 'pointer', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}
          onClick={() => setAddOpen(true)}
        >
          + Wingert hinzufügen
        </Typography>
      </Box>
      {selected && (
        <>
          <Divider />
          <VineyardDetail vineyard={selected} />
        </>
      )}
    </Box>
  )

  const taskTabContent = (
    <Box sx={{ overflow: 'auto', flex: 1 }}>
      <GlobalTasksPanel
        tasks={tasks}
        loading={tasksLoading}
        error={tasksError}
        pendingLocation={pendingLocation}
        onStartPicking={handleStartPicking}
        onCancelPicking={() => { setPickingLocation(false); setPendingLocation(null) }}
        onGPSLocation={setPendingLocation}
        onCreate={handleCreateTask}
        onStatusChange={changeStatus}
        onDelete={removeTask}
        onLocate={handleLocateTask}
      />
    </Box>
  )

  const varietyTabContent = (
    <Box sx={{ overflow: 'auto', flex: 1 }}>
      <VarietyManager />
    </Box>
  )

  const harvestTabContent = (
    <Box sx={{ overflow: 'auto', flex: 1 }}>
      <HarvestPage vineyard={selected} />
    </Box>
  )

  const personalTabContent = (
    <Box sx={{ overflow: 'auto', flex: 1 }}>
      <PersonalPage vineyard={selected} />
    </Box>
  )

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Tabs
        value={drawerTab}
        onChange={(_, v) => setDrawerTab(v)}
        variant="fullWidth"
        sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 44 }}
      >
        <Tab
          icon={<ForestIcon fontSize="small" />}
          iconPosition="start"
          label="Weinberge"
          sx={{ minHeight: 44, fontSize: '0.7rem' }}
        />
        <Tab
          icon={
            <Badge badgeContent={openTaskCount} color="error" max={99}>
              <ListAltIcon fontSize="small" />
            </Badge>
          }
          iconPosition="start"
          label="Aufgaben"
          sx={{ minHeight: 44, fontSize: '0.7rem' }}
        />
        <Tab
          icon={<GrapeIcon fontSize="small" />}
          iconPosition="start"
          label="Sorten"
          sx={{ minHeight: 44, fontSize: '0.7rem' }}
        />
        <Tab
          icon={<AgricultureIcon fontSize="small" />}
          iconPosition="start"
          label="Ernte"
          sx={{ minHeight: 44, fontSize: '0.7rem' }}
        />
        <Tab
          icon={<PeopleIcon fontSize="small" />}
          iconPosition="start"
          label="Personal"
          sx={{ minHeight: 44, fontSize: '0.7rem' }}
        />
      </Tabs>
      {drawerTab === 0 && vineyardTabContent}
      {drawerTab === 1 && taskTabContent}
      {drawerTab === 2 && varietyTabContent}
      {drawerTab === 3 && harvestTabContent}
      {drawerTab === 4 && personalTabContent}
    </Box>
  )

  const APPBAR_HEIGHT = 48

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar variant="dense">
          <Typography variant="h6" sx={{ flexGrow: 1 }}>Wingertmap</Typography>
          {user && !isMobile && (
            <Typography variant="body2" sx={{ mr: 2, opacity: 0.8 }}>{user.name}</Typography>
          )}
          <IconButton color="inherit" onClick={logout} title="Abmelden">
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Desktop: permanent sidebar */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', top: `${APPBAR_HEIGHT}px` },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Mobile: swipeable bottom sheet */}
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
              height: '70vh',
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
              top: 'auto',
            },
          }}
        >
          {/* Drag handle */}
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1, pb: 0.5 }}>
            <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'divider' }} />
          </Box>
          {drawerContent}
        </SwipeableDrawer>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          mt: `${APPBAR_HEIGHT}px`,
          display: 'flex',
          flexDirection: 'column',
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
        />
      </Box>

      {/* Mobile FAB to open drawer */}
      {isMobile && (
        <Fab
          color="primary"
          size="medium"
          onClick={() => { setDrawerTab(1); setMobileDrawerOpen(true) }}
          sx={{ position: 'fixed', bottom: 24, right: 16, zIndex: 1000 }}
        >
          <Badge badgeContent={openTaskCount} color="error" max={99}>
            <ListAltIcon />
          </Badge>
        </Fab>
      )}

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
  const [showRegister, setShowRegister] = useState(false)
  const navigate = useNavigate()

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
      <Box sx={{ bgcolor: 'background.paper', p: 4, borderRadius: 2, boxShadow: 3, width: '100%', maxWidth: 400 }}>
        <Typography variant="h4" color="primary" gutterBottom>Wingertmap</Typography>
        {showRegister ? (
          <>
            <RegisterForm onSuccess={() => setShowRegister(false)} />
            <Typography variant="body2" sx={{ mt: 2, cursor: 'pointer', color: 'text.secondary' }} onClick={() => setShowRegister(false)}>
              Bereits registriert? Anmelden
            </Typography>
          </>
        ) : (
          <>
            <LoginForm onSuccess={() => navigate('/')} />
            <Typography variant="body2" sx={{ mt: 2, cursor: 'pointer', color: 'text.secondary' }} onClick={() => setShowRegister(true)}>
              Noch kein Konto? Registrieren
            </Typography>
          </>
        )}
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
