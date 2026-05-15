import { useState, useEffect, useRef } from 'react'
import {
  Box, AppBar, Toolbar, Typography, IconButton,
  Divider, Dialog, DialogTitle, DialogContent,
  Button, Badge, Snackbar, Alert,
} from '@mui/material'
import LogoutIcon from '@mui/icons-material/Logout'
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts'
import AddIcon from '@mui/icons-material/Add'
import ForestIcon from '@mui/icons-material/Forest'
import GrapeIcon from '@mui/icons-material/Spa'
import PeopleIcon from '@mui/icons-material/People'
import ListAltIcon from '@mui/icons-material/ListAlt'
import BarChartIcon from '@mui/icons-material/BarChart'
import WorkIcon from '@mui/icons-material/Work'
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety'
import { useAuthStore } from '../../store/authStore'
import { useMapStore } from '../../store/mapStore'
import { useVineyardStore } from '../../store/vineyardStore'
import { useTaskStore } from '../../store/taskStore'
import { useNavigationStore } from '../../store/navigationStore'
import { useMobile } from '../../hooks/useMobile'
import ChangePasswordForm from '../Auth/ChangePasswordForm'
import VineyardList from '../Vineyard/VineyardList'
import VineyardDetail from '../Vineyard/VineyardDetail'
import VineyardForm from '../Vineyard/VineyardForm'
import VineyardMap from '../Map/VineyardMap'
import GlobalTasksPanel from '../Tasks/GlobalTasksPanel'
import VarietyManager from '../Varieties/VarietyManager'
import PersonalPage from '../Personal/PersonalPage'
import WorkTypesPage from '../Personal/WorkTypesPage'
import AnalyticsPage from '../Analytics/AnalyticsPage'
import DesktopLayout from './DesktopLayout'
import MobileLayout from './MobileLayout'
import ProtectionPanel from '../Vineyard/ProtectionPanel'
import QuickActionSheet from './QuickActionSheet'
import QuickTimeEntrySheet from './QuickTimeEntrySheet'
import QuickHarvestSheet from './QuickHarvestSheet'
import QuickPruningSheet from './QuickPruningSheet'
import type { Vineyard, GeoJSONPolygon, GeoJSONLineString, GeoJSONPoint, Task } from '../../types'
import { polygonCenter } from '../../utils/geo'

const APPBAR_HEIGHT = 48

const TAB_LABELS: Record<number, string> = {
  0: 'Weinberge',
  1: 'Aufgaben',
  2: 'Auswertungen',
  3: 'Sorten',
  4: 'Personal',
  5: 'Tätigkeiten',
  6: 'Pflanzenschutz',
}

const nutzungItems = [
  { index: 0, label: 'Weinberge', icon: <ForestIcon fontSize="small" /> },
  { index: 1, label: 'Aufgaben', icon: <ListAltIcon fontSize="small" /> },
  { index: 6, label: 'Pflanzenschutz', icon: <HealthAndSafetyIcon fontSize="small" /> },
]
const analyseItems = [
  { index: 2, label: 'Auswertungen', icon: <BarChartIcon fontSize="small" /> },
]
const verwaltungItems = [
  { index: 3, label: 'Sorten', icon: <GrapeIcon fontSize="small" /> },
  { index: 4, label: 'Personal', icon: <PeopleIcon fontSize="small" /> },
  { index: 5, label: 'Tätigkeiten', icon: <WorkIcon fontSize="small" /> },
]

export default function MainLayout() {
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const hydrate = useAuthStore((s) => s.hydrate)

  useEffect(() => { hydrate() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { setCenter, setZoom } = useMapStore()
  const { vineyards } = useVineyardStore()
  const {
    tasks, loading: tasksLoading, error: tasksError,
    load: loadTasks, create: createTask, changeStatus, remove: removeTask,
    notification, clearNotification,
  } = useTaskStore()

  const isMobile = useMobile()
  const {
    activeTab, mobileSheetOpen, desktopPanelOpen, fabTrigger, quickActionOpen,
    setActiveTab, setMobileSheetOpen, toggleDesktopPanel, triggerFAB,
    openQuickAction, closeQuickAction,
  } = useNavigationStore()

  const [selected, setSelected] = useState<Vineyard | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [changePwOpen, setChangePwOpen] = useState(false)
  const [pendingBoundary, setPendingBoundary] = useState<GeoJSONPolygon | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [pickingLocation, setPickingLocation] = useState(false)
  const [pendingLocation, setPendingLocation] = useState<GeoJSONPoint | null>(null)
  const [hoursSheetOpen, setHoursSheetOpen] = useState(false)
  const [harvestSheetOpen, setHarvestSheetOpen] = useState(false)
  const [pruningSheetOpen, setPruningSheetOpen] = useState(false)
  const [taskDialogMode, setTaskDialogMode] = useState<'pflanzenschutz' | null>(null)
  const flyToRef = useRef<((lat: number, lng: number, zoom?: number) => void) | null>(null)
  const pendingFlyToRef = useRef<[number, number, number] | null>(null)
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
    if (fav) { hasAutoSelected.current = true; selectVineyard(fav) }
  }, [vineyards]) // eslint-disable-line react-hooks/exhaustive-deps

  function selectVineyard(v: Vineyard) {
    setSelected(v)
    if (v.boundary) {
      const center = polygonCenter(v.boundary)
      setCenter(center)
      setZoom(17)
      if (flyToRef.current) {
        flyToRef.current(center[0], center[1], 17)
      } else {
        pendingFlyToRef.current = [center[0], center[1], 17]
      }
    }
    if (isMobile) setMobileSheetOpen(false)
  }

  function handleDrawComplete(geometry: GeoJSONPolygon | GeoJSONLineString) {
    if (geometry.type !== 'Polygon') return
    setPendingBoundary(geometry as GeoJSONPolygon)
    setAddOpen(true)
  }

  function handleLocationPicked(p: GeoJSONPoint) {
    setPickingLocation(false)
    setPendingLocation(p)
    // triggerFAB atomically sets activeTab=1, mobileSheetOpen=true, fabTrigger++
    // so GlobalTasksPanel reliably opens the dialog via the fabTrigger effect.
    if (isMobile) triggerFAB()
  }

  function handleLocateTask(task: Task) {
    if (!task.location) return
    const [lng, lat] = task.location.coordinates
    if (task.vineyardId) {
      const v = vineyards.find((v) => v.id === task.vineyardId)
      if (v) setSelected(v)
    }
    flyToRef.current?.(lat, lng, 20)
    if (isMobile) setMobileSheetOpen(false)
    setSelectedTask(null)
  }

  function handleTaskSelect(task: Task | null) {
    setSelectedTask(task)
    if (task) {
      setActiveTab(1)
      if (isMobile) setMobileSheetOpen(true)
      else toggleDesktopPanel(1)
    }
  }

  async function handleCreateTask(params: Parameters<typeof createTask>[0]) {
    const task = await createTask({ ...params, vineyardId: selected?.id })
    setPendingLocation(null)
    return task
  }

  function handleStartPicking() {
    if (isMobile) {
      setMobileSheetOpen(false)
      setTimeout(() => setPickingLocation(true), 350)
    } else {
      setPickingLocation(true)
    }
  }

  function handleFABPress() {
    openQuickAction()
  }

  function handleQuickTask() {
    setTaskDialogMode(null)
    triggerFAB()
  }

  function handleQuickPflanzenschutz() {
    setTaskDialogMode('pflanzenschutz')
    triggerFAB()
  }

  function handleQuickHours() {
    setHoursSheetOpen(true)
  }

  function handleQuickHarvest() {
    setHarvestSheetOpen(true)
  }

  function handleQuickPruning() {
    setPruningSheetOpen(true)
  }

  function handleQuickDrawVineyard() {
    closeQuickAction()
    setMobileSheetOpen(false)
    useMapStore.getState().setDrawingMode('polygon')
  }

  function handleQuickDrawRow() {
    closeQuickAction()
    setMobileSheetOpen(false)
    useMapStore.getState().setDrawingMode('linestring')
  }

  const openTaskCount = tasks.filter((t) => t.status !== 'erledigt').length

  const tabContents: React.ReactNode[] = [
    <Box key="weinberge" sx={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
      <VineyardList onSelect={selectVineyard} />
      {selected && (
        <>
          <Divider />
          <VineyardDetail vineyard={selected} />
        </>
      )}
    </Box>,
    <Box key="aufgaben" sx={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
      <GlobalTasksPanel
        tasks={tasks}
        loading={tasksLoading}
        error={tasksError}
        pendingLocation={pendingLocation}
        selectedTask={selectedTask}
        fabTrigger={fabTrigger}
        mode={taskDialogMode}
        onStartPicking={handleStartPicking}
        onCancelPicking={() => { setPickingLocation(false); setPendingLocation(null) }}
        onCreate={handleCreateTask}
        onStatusChange={changeStatus}
        onDelete={removeTask}
        onLocate={handleLocateTask}
        onTaskSelect={handleTaskSelect}
        onDialogClose={() => setTaskDialogMode(null)}
      />
    </Box>,
    <AnalyticsPage key="analytics" vineyard={selected} />,
    <Box key="sorten" sx={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
      <VarietyManager />
    </Box>,
    <Box key="personal" sx={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
      <PersonalPage />
    </Box>,
    <Box key="workTypes" sx={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
      <WorkTypesPage />
    </Box>,
    <Box key="pflanzenschutz" sx={{ overflow: 'auto', flex: 1, minHeight: 0, p: 2 }}>
      {selected ? (
        <ProtectionPanel vineyardId={selected.id} />
      ) : (
        <Typography variant="body2" color="text.secondary">
          Wähle einen Wingert im «Weinberge»-Tab, um den Pflanzenschutz-Status zu sehen.
        </Typography>
      )}
    </Box>,
  ]

  const nutzungItemsWithBadge = nutzungItems.map((item) =>
    item.index === 1
      ? { ...item, icon: <Badge badgeContent={openTaskCount} color="error" max={99}><ListAltIcon fontSize="small" /></Badge> }
      : item
  )

  const mapContent = (
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
        onVineyardClick={(v) => { selectVineyard(v); if (isMobile) setMobileSheetOpen(false) }}
        tasks={tasks.filter((t) => t.status !== 'erledigt')}
        pickingLocation={pickingLocation}
        onLocationPicked={handleLocationPicked}
        onCancelPicking={() => { setPickingLocation(false); setPendingLocation(null) }}
        onFlyTo={(handler) => {
          flyToRef.current = handler
          if (pendingFlyToRef.current) {
            handler(...pendingFlyToRef.current)
            pendingFlyToRef.current = null
          }
        }}
        onTaskSelect={handleTaskSelect}
      />
    </Box>
  )

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
            <IconButton
              color="inherit"
              size="small"
              onClick={() => setChangePwOpen(true)}
              aria-label="Passwort ändern"
              title="Passwort ändern"
              sx={{ mr: 0.5 }}
            >
              <ManageAccountsIcon fontSize="small" />
            </IconButton>
          )}
          {token && !isMobile && (
            <IconButton
              color="inherit"
              onClick={openQuickAction}
              sx={{ minWidth: 44, minHeight: 44 }}
              title="Schnellaktionen"
              aria-label="Schnellaktionen"
            >
              <AddIcon />
            </IconButton>
          )}
          <IconButton color="inherit" onClick={logout} aria-label="Abmelden" title="Abmelden">
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {isMobile ? (
        <MobileLayout
          activeTab={activeTab}
          sheetOpen={mobileSheetOpen}
          sheetContent={tabContents[activeTab]}
          taskBadgeCount={openTaskCount}
          onTabChange={setActiveTab}
          onSheetOpenChange={setMobileSheetOpen}
          onFABPress={handleFABPress}
        >
          {mapContent}
        </MobileLayout>
      ) : (
        <DesktopLayout
          activeTab={activeTab}
          panelOpen={desktopPanelOpen}
          panelLabel={TAB_LABELS[activeTab]}
          panelContent={tabContents[activeTab]}
          nutzungItems={nutzungItemsWithBadge}
          analyseItems={analyseItems}
          einstellungenItems={verwaltungItems}
          onNavClick={toggleDesktopPanel}
        >
          {mapContent}
        </DesktopLayout>
      )}

      {/* Quick action overlays */}
      <QuickActionSheet
        open={quickActionOpen}
        hasVineyard={!!selected}
        onClose={closeQuickAction}
        onCreateTask={handleQuickTask}
        onCreatePflanzenschutz={handleQuickPflanzenschutz}
        onLogHours={handleQuickHours}
        onLogHarvest={handleQuickHarvest}
        onLogPruning={handleQuickPruning}
        onDrawVineyard={handleQuickDrawVineyard}
        onDrawRow={handleQuickDrawRow}
      />
      <QuickTimeEntrySheet
        open={hoursSheetOpen}
        vineyard={selected}
        onClose={() => setHoursSheetOpen(false)}
      />
      <QuickHarvestSheet
        open={harvestSheetOpen}
        vineyard={selected}
        onClose={() => setHarvestSheetOpen(false)}
      />
      <QuickPruningSheet
        open={pruningSheetOpen}
        vineyard={selected}
        onClose={() => setPruningSheetOpen(false)}
      />

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
