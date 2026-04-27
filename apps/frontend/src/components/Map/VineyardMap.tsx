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
import L from 'leaflet'
import { useMapStore } from '../../store/mapStore'
import { useGPS } from '../../hooks/useGPS'
import { useVineyardStore } from '../../store/vineyardStore'
import DrawingTools from './DrawingTools'
import RowLayer from './RowLayer'
import VineTaskDialog from '../Tasks/VineTaskDialog'
import type { GeoJSONPolygon, GeoJSONLineString, GeoJSONPoint, Row, Task, Vine, Vineyard } from '../../types'
import { listRows, createRow } from '../../api/rows'
import { listPhotos } from '../../api/photos'
import type { TaskPhoto } from '../../api/photos'
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

function TaskMarker({ task }: { task: Task }) {
  const [photos, setPhotos] = useState<TaskPhoto[]>([])
  const [loaded, setLoaded] = useState(false)

  function handleOpen() {
    if (loaded) return
    setLoaded(true)
    listPhotos(task.id).then(setPhotos).catch(() => {})
  }

  return (
    <Marker
      position={[task.location!.coordinates[1], task.location!.coordinates[0]]}
      icon={taskIcon}
      eventHandlers={{ popupopen: handleOpen }}
    >
      <Popup minWidth={160}>
        <strong style={{ fontSize: 13 }}>{task.title}</strong>
        {task.notes && <p style={{ fontSize: 12, margin: '4px 0 0', color: '#555' }}>{task.notes}</p>}
        {photos.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {photos.map((p) => (
              <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                <img
                  src={p.url}
                  alt=""
                  style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 4, display: 'block' }}
                />
              </a>
            ))}
          </div>
        )}
      </Popup>
    </Marker>
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
}

type BaseLayer = 'karte' | 'luftbild'

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

export default function VineyardMap({
  onDrawComplete, selectedVineyardId, onVineyardClick,
  tasks = [], pickingLocation = false, onLocationPicked, onFlyTo,
}: Props) {
  const { center, zoom, drawingMode, setDrawingMode } = useMapStore()
  const { vineyards } = useVineyardStore()
  const { position, error: gpsError, startWatching, stopWatching } = useGPS()
  const [gpsActive, setGpsActive] = useState(false)
  const [baseLayer, setBaseLayer] = useState<BaseLayer>('karte')
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
        width: '100%', height: '100%', position: 'relative',
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

        {vineyards.map((v) => {
          if (!v.boundary) return null
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
              eventHandlers={{ click: () => onVineyardClick?.(v) }}
            >
              <LeafletTooltip>{v.name}</LeafletTooltip>
            </Polygon>
          )
        })}

        {/* Task markers */}
        {tasks.filter((t) => t.location).map((t) => (
          <TaskMarker key={t.id} task={t} />
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

        {gpsError && <Chip label={gpsError} color="error" size="small" sx={{ maxWidth: 160 }} />}
      </Box>

      <VineTaskDialog vine={selectedVine} onClose={() => setSelectedVine(null)} />
    </Box>
  )
}
