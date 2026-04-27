import { useState, useEffect, useCallback, useRef } from 'react'
import {
  MapContainer, TileLayer, CircleMarker, Popup, Polygon,
  Tooltip as LeafletTooltip, useMap, useMapEvents,
} from 'react-leaflet'
import { Box, ToggleButton, ToggleButtonGroup, Tooltip, IconButton, Chip } from '@mui/material'
import PentagonIcon from '@mui/icons-material/Pentagon'
import TimelineIcon from '@mui/icons-material/Timeline'
import GpsFixedIcon from '@mui/icons-material/GpsFixed'
import GpsOffIcon from '@mui/icons-material/GpsOff'
import MapIcon from '@mui/icons-material/Map'
import SatelliteAltIcon from '@mui/icons-material/SatelliteAlt'
import AddLocationAltIcon from '@mui/icons-material/AddLocationAlt'
import TerrainIcon from '@mui/icons-material/Terrain'
import GradientIcon from '@mui/icons-material/Gradient'
import HeightIcon from '@mui/icons-material/Height'
import L from 'leaflet'
import { useMapStore } from '../../store/mapStore'
import { useGPS } from '../../hooks/useGPS'
import { useVineyardStore } from '../../store/vineyardStore'
import DrawingTools from './DrawingTools'
import RowLayer from './RowLayer'
import VineTaskDialog from '../Tasks/VineTaskDialog'
import type { GeoJSONPolygon, GeoJSONLineString, GeoJSONPoint, Row, Task, Vine, Vineyard } from '../../types'
import { listRows, createRow } from '../../api/rows'
import { updateVineyard } from '../../api/vineyards'
import 'leaflet/dist/leaflet.css'

function FlyToCenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  const prevCenter = useRef<[number, number] | null>(null)
  useEffect(() => {
    const [lat, lng] = center
    const prev = prevCenter.current
    if (prev && prev[0] === lat && prev[1] === lng) return
    prevCenter.current = center
    map.flyTo(center, zoom, { duration: 1 })
  }, [center, zoom, map])
  return null
}

// Listens for map clicks when picking mode is active
function LocationPicker({ onPick }: { onPick: (p: GeoJSONPoint) => void }) {
  useMapEvents({
    click(e) {
      onPick({ type: 'Point', coordinates: [e.latlng.lng, e.latlng.lat] })
    },
  })
  return null
}

// Task markers on the map
const taskIcon = L.divIcon({
  className: '',
  html: '<div style="width:12px;height:12px;background:#f59e0b;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

import { Marker } from 'react-leaflet'

function TaskMarker({ task, onTaskSelect }: { task: Task; onTaskSelect?: (t: Task) => void }) {
  return (
    <Marker
      position={[task.location!.coordinates[1], task.location!.coordinates[0]]}
      icon={taskIcon}
      eventHandlers={{ click: () => onTaskSelect?.(task) }}
    />
  )
}

interface Props {
  onDrawComplete?: (geometry: GeoJSONPolygon | GeoJSONLineString) => void
  selectedVineyardId?: string | null
  onVineyardClick?: (v: Vineyard) => void
  tasks?: Task[]
  pickingLocation?: boolean
  onLocationPicked?: (p: GeoJSONPoint) => void
  onFlyTo?: (handler: (lat: number, lng: number, zoom?: number) => void) => void
  onTaskSelect?: (task: Task) => void
}

type BaseLayer = 'karte' | 'luftbild'
type OverlayKey = 'relief' | 'hangneigung' | 'hoehe'

const OVERLAYS: { key: OverlayKey; label: string; icon: React.ReactNode; url?: string; opacity?: number }[] = [
  {
    key: 'relief',
    label: 'LiDAR Reliefschattierung',
    icon: <TerrainIcon fontSize="small" />,
    url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissalti3d-reliefschattierung/default/current/3857/{z}/{x}/{y}.png',
    opacity: 0.5,
  },
  {
    key: 'hangneigung',
    label: 'Steillagen Rebbau',
    icon: <GradientIcon fontSize="small" />,
    url: 'https://wmts.geo.admin.ch/1.0.0/ch.blw.steil_terrassenlagen_rebbau/default/current/3857/{z}/{x}/{y}.png',
    opacity: 0.6,
  },
  {
    key: 'hoehe',
    label: 'Höhe bei Klick',
    icon: <HeightIcon fontSize="small" />,
  },
]

function FlyToHandler({ onFlyTo }: { onFlyTo?: (handler: (lat: number, lng: number, zoom?: number) => void) => void }) {
  const map = useMap()
  useEffect(() => {
    if (!onFlyTo) return
    onFlyTo((lat, lng, zoom) => {
      map.flyTo([lat, lng], zoom ?? map.getZoom(), { duration: 1 })
    })
  }, [map, onFlyTo])
  return null
}

/** Approximate WGS84 → LV95 conversion (swisstopo formula, ~1m accuracy) */
function wgs84ToLV95(lat: number, lng: number): [number, number] {
  const phi = (lat * 3600 - 169028.66) / 10000
  const lam = (lng * 3600 - 26782.5) / 10000
  const e = 2600072.37 + 211455.93 * lam - 10938.51 * lam * phi - 0.36 * lam * phi * phi - 44.54 * lam * lam * lam
  const n = 1200147.07 + 308807.95 * phi + 3745.25 * lam * lam + 76.63 * phi * phi - 194.56 * lam * lam * phi + 119.79 * phi * phi * phi
  return [e, n]
}

function ElevationQuery() {
  const map = useMap()
  useMapEvents({
    click(e) {
      const [east, north] = wgs84ToLV95(e.latlng.lat, e.latlng.lng)
      fetch(`https://api3.geo.admin.ch/rest/services/height?easting=${east}&northing=${north}&sr=2056`)
        .then((r) => r.json())
        .then((d) => {
          const h = parseFloat(d.height)
          if (isNaN(h)) return
          L.popup({ closeButton: true })
            .setLatLng(e.latlng)
            .setContent(`<b>${Math.round(h)} m ü.M.</b>`)
            .openOn(map)
        })
        .catch(() => {})
    },
  })
  return null
}

function VineyardActionPanel({ vineyard, onEdit, onClose }: {
  vineyard: Vineyard
  onEdit: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (ref.current) L.DomEvent.disableClickPropagation(ref.current) }, [])
  return (
    <div ref={ref} style={{
      position: 'absolute', bottom: 'var(--map-panel-bottom, 20px)', left: '50%', transform: 'translateX(-50%)',
      zIndex: 1000, background: '#fff', borderRadius: 8, padding: '10px 14px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: 10,
      fontSize: 13, whiteSpace: 'nowrap',
    }}>
      <strong>{vineyard.name}</strong>
      <span style={{ borderLeft: '1px solid #ddd', height: 20 }} />
      {vineyard.boundary && (
        <button onClick={onEdit} style={vBtnStyle('#1d4ed8')}>✎ Grenze bearbeiten</button>
      )}
      <button onClick={onClose} style={{ ...vBtnStyle('#6b7280'), padding: '3px 6px' }}>✕</button>
    </div>
  )
}

function vBtnStyle(bg: string): import('react').CSSProperties {
  return { background: bg, color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 500 }
}

function VineyardBoundaries({ vineyards, selectedVineyardId, onVineyardClick, onBoundaryUpdated, pickingLocation }: {
  vineyards: Vineyard[]
  selectedVineyardId?: string | null
  onVineyardClick?: (v: Vineyard) => void
  onBoundaryUpdated: () => void
  pickingLocation: boolean
}) {
  const map = useMap()
  const [panelVineyard, setPanelVineyard] = useState<Vineyard | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  function handlePolygonClick(v: Vineyard) {
    if (pickingLocation) return
    if (v.id === selectedVineyardId) {
      setPanelVineyard((prev) => prev?.id === v.id ? null : v)
    } else {
      setPanelVineyard(null)
      onVineyardClick?.(v)
    }
  }

  async function handleEdit(v: Vineyard) {
    if (!v.boundary) return
    setPanelVineyard(null)
    setEditingId(v.id)

    const coords = v.boundary.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number])
    const poly = L.polygon(coords, { color: '#1d4ed8', weight: 2 }).addTo(map)
    const editHandler = new (L.EditToolbar.Edit as any)(map, { featureGroup: L.featureGroup([poly]) })
    editHandler.enable()

    function cancel() {
      map.off('click', onSave)
      editHandler.disable()
      try { map.removeLayer(poly) } catch {}
      setEditingId(null)
      document.removeEventListener('keydown', onEscape)
    }

    async function onSave() {
      editHandler.save()
      const rings = poly.getLatLngs() as L.LatLng[][]
      cancel()
      const ring = rings[0] as L.LatLng[]
      if (ring && ring.length >= 3) {
        const closed = [...ring.map((ll): [number, number] => [ll.lng, ll.lat]), [ring[0].lng, ring[0].lat] as [number, number]]
        const boundary: GeoJSONPolygon = { type: 'Polygon', coordinates: [closed] }
        await updateVineyard(v.id, { name: v.name, description: v.description, boundary })
        onBoundaryUpdated()
      }
    }

    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') cancel()
    }

    map.once('click', onSave)
    document.addEventListener('keydown', onEscape)
  }

  return (
    <>
      {vineyards.map((v) => {
        if (!v.boundary || editingId === v.id) return null
        const positions = v.boundary.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number])
        const isSelected = v.id === selectedVineyardId
        return (
          <Polygon
            key={v.id}
            positions={positions}
            pathOptions={{
              color: isSelected ? '#15803d' : '#6b7280',
              fillColor: isSelected ? '#15803d' : '#6b7280',
              fillOpacity: isSelected ? 0.15 : 0.08,
              weight: isSelected ? 2.5 : 1.5,
            }}
            eventHandlers={{ click: () => handlePolygonClick(v) }}
          >
            <LeafletTooltip>{v.name}</LeafletTooltip>
          </Polygon>
        )
      })}
      {panelVineyard && (
        <VineyardActionPanel
          vineyard={panelVineyard}
          onEdit={() => handleEdit(panelVineyard)}
          onClose={() => setPanelVineyard(null)}
        />
      )}
    </>
  )
}

export default function VineyardMap({
  onDrawComplete, selectedVineyardId, onVineyardClick,
  tasks = [], pickingLocation = false, onLocationPicked, onFlyTo, onTaskSelect,
}: Props) {
  const { center, zoom, drawingMode, setDrawingMode } = useMapStore()
  const { vineyards, load: reloadVineyards } = useVineyardStore()
  const { position, error: gpsError, startWatching, stopWatching } = useGPS()
  const [gpsActive, setGpsActive] = useState(false)
  const [baseLayer, setBaseLayer] = useState<BaseLayer>('karte')
  const [activeOverlays, setActiveOverlays] = useState<OverlayKey[]>([])

  function toggleOverlay(key: OverlayKey) {
    setActiveOverlays((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }
  const [rows, setRows] = useState<Row[]>([])
  const [selectedVine, setSelectedVine] = useState<Vine | null>(null)

  const loadRows = useCallback(async () => {
    if (!selectedVineyardId) { setRows([]); return }
    const data = await listRows(selectedVineyardId)
    setRows(data)
  }, [selectedVineyardId])

  useEffect(() => { loadRows() }, [loadRows])

  function toggleGPS() {
    if (gpsActive) { stopWatching(); setGpsActive(false) }
    else { startWatching(); setGpsActive(true) }
  }

  const onDrawCompleteRef = useRef(onDrawComplete)
  useEffect(() => { onDrawCompleteRef.current = onDrawComplete }, [onDrawComplete])
  const selectedVineyardIdRef = useRef(selectedVineyardId)
  useEffect(() => { selectedVineyardIdRef.current = selectedVineyardId }, [selectedVineyardId])

  const handleDrawComplete = useCallback(async (geometry: GeoJSONPolygon | GeoJSONLineString) => {
    if (geometry.type === 'LineString' && selectedVineyardIdRef.current) {
      await createRow(selectedVineyardIdRef.current, { line: geometry as GeoJSONLineString })
      loadRows()
    }
    onDrawCompleteRef.current?.(geometry)
  }, [loadRows])

  return (
    <Box
      data-testid="vineyard-map"
      sx={{
        width: '100%', flex: 1, minHeight: 0, position: 'relative',
        cursor: pickingLocation ? 'crosshair' : undefined,
      }}
    >
      <MapContainer center={center} zoom={zoom} maxZoom={22} style={{ height: '100%', width: '100%' }}>
        {baseLayer === 'luftbild' ? (
          <TileLayer
            url="https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg"
            attribution="&copy; swisstopo"
            maxNativeZoom={20}
            maxZoom={22}
          />
        ) : (
          <TileLayer
            url="https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg"
            attribution="&copy; swisstopo"
            maxNativeZoom={18}
            maxZoom={22}
          />
        )}
        <FlyToCenter center={center} zoom={zoom} />
        <FlyToHandler onFlyTo={onFlyTo} />

        {OVERLAYS.filter((o) => o.url && activeOverlays.includes(o.key)).map((o) => (
          <TileLayer key={o.key} url={o.url!} opacity={o.opacity} maxNativeZoom={18} maxZoom={22} />
        ))}
        {activeOverlays.includes('hoehe') && !pickingLocation && <ElevationQuery />}

        <VineyardBoundaries
          vineyards={vineyards}
          selectedVineyardId={selectedVineyardId}
          onVineyardClick={onVineyardClick}
          onBoundaryUpdated={reloadVineyards}
          pickingLocation={pickingLocation}
        />

        {/* Task markers */}
        {tasks.filter((t) => t.location).map((t) => (
          <TaskMarker key={t.id} task={t} onTaskSelect={onTaskSelect} />
        ))}

        <DrawingTools onDrawComplete={handleDrawComplete} />
        {selectedVineyardId && (
          <RowLayer
            rows={rows}
            vineyardId={selectedVineyardId}
            onChanged={loadRows}
            onVineSelect={setSelectedVine}
          />
        )}
        {position && (
          <CircleMarker
            center={[position.lat, position.lng]}
            radius={8}
            pathOptions={{ color: '#1976d2', fillColor: '#1976d2', fillOpacity: 0.9 }}
          >
            <Popup>Mein Standort<br />±{Math.round(position.accuracy)} m</Popup>
          </CircleMarker>
        )}
        {pickingLocation && onLocationPicked && (
          <LocationPicker onPick={onLocationPicked} />
        )}
      </MapContainer>

      <Box sx={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {pickingLocation && (
          <Chip
            label="Standort wählen…"
            color="warning"
            size="small"
            icon={<AddLocationAltIcon />}
            sx={{ alignSelf: 'flex-end' }}
          />
        )}
        <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, boxShadow: 2 }}>
          <ToggleButtonGroup
            orientation="vertical"
            value={drawingMode === 'none' ? null : drawingMode}
            exclusive
            onChange={(_, v) => { setDrawingMode(v ?? 'none') }}
            size="small"
          >
            <Tooltip title="Wingert zeichnen" placement="left">
              <ToggleButton value="polygon" aria-label="Wingert zeichnen">
                <PentagonIcon fontSize="small" />
              </ToggleButton>
            </Tooltip>
            <Tooltip title="Reihe zeichnen" placement="left">
              <ToggleButton value="linestring" aria-label="Reihe zeichnen">
                <TimelineIcon fontSize="small" />
              </ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>
        </Box>

        <Tooltip title={gpsActive ? 'GPS deaktivieren' : 'GPS aktivieren'} placement="left">
          <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, boxShadow: 2 }}>
            <IconButton size="small" onClick={toggleGPS} color={gpsActive ? 'primary' : 'default'} aria-label="GPS">
              {gpsActive ? <GpsFixedIcon fontSize="small" /> : <GpsOffIcon fontSize="small" />}
            </IconButton>
          </Box>
        </Tooltip>

        <Tooltip title={baseLayer === 'karte' ? 'Luftbild anzeigen' : 'Karte anzeigen'} placement="left">
          <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, boxShadow: 2 }}>
            <IconButton size="small" onClick={() => setBaseLayer(b => b === 'karte' ? 'luftbild' : 'karte')} aria-label="Kartenebene">
              {baseLayer === 'karte' ? <SatelliteAltIcon fontSize="small" /> : <MapIcon fontSize="small" />}
            </IconButton>
          </Box>
        </Tooltip>

        <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, boxShadow: 2 }}>
          <ToggleButtonGroup orientation="vertical" size="small">
            {OVERLAYS.map((o, i) => (
              <Tooltip key={o.key} title={o.label} placement="left">
                <span>
                  <ToggleButton
                    value={o.key}
                    selected={activeOverlays.includes(o.key)}
                    onChange={() => toggleOverlay(o.key)}
                    aria-label={o.label}
                    sx={i < OVERLAYS.length - 1 ? { borderBottom: 1, borderColor: 'divider' } : undefined}
                  >
                    {o.icon}
                  </ToggleButton>
                </span>
              </Tooltip>
            ))}
          </ToggleButtonGroup>
        </Box>

        {gpsError && <Chip label={gpsError} color="error" size="small" sx={{ maxWidth: 160 }} />}
      </Box>

      <VineTaskDialog vine={selectedVine} onClose={() => setSelectedVine(null)} />
    </Box>
  )
}
