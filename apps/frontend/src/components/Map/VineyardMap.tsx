import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Map, { Source, Layer, Marker, useMap, useControl } from 'react-map-gl/maplibre'
import type { MapRef, MapLayerMouseEvent } from 'react-map-gl/maplibre'
import type { TerrainSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import MapboxDraw from 'maplibre-gl-draw'
import 'maplibre-gl-draw/dist/mapbox-gl-draw.css'
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
import ViewInArIcon from '@mui/icons-material/ViewInAr'
import { useMapStore } from '../../store/mapStore'
import type { DrawingMode } from '../../store/mapStore'
import { useGPS } from '../../hooks/useGPS'
import { useVineyardStore } from '../../store/vineyardStore'
import DrawingTools from './DrawingTools'
import RowLayer from './RowLayer'
import VineTaskDialog from '../Tasks/VineTaskDialog'
import type { GeoJSONPolygon, GeoJSONLineString, GeoJSONPoint, Row, Task, Vine, Vineyard } from '../../types'
import { listRows, createRow } from '../../api/rows'
import { updateVineyard } from '../../api/vineyards'

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

/** Approximate WGS84 → LV95 (~1m accuracy) */
function wgs84ToLV95(lat: number, lng: number): [number, number] {
  const phi = (lat * 3600 - 169028.66) / 10000
  const lam = (lng * 3600 - 26782.5) / 10000
  const e = 2600072.37 + 211455.93 * lam - 10938.51 * lam * phi - 0.36 * lam * phi * phi - 44.54 * lam * lam * lam
  const n = 1200147.07 + 308807.95 * phi + 3745.25 * lam * lam + 76.63 * phi * phi - 194.56 * lam * lam * phi + 119.79 * phi * phi * phi
  return [e, n]
}

function buildMapStyle(baseLayer: BaseLayer, activeOverlays: OverlayKey[]) {
  const baseUrl = baseLayer === 'luftbild'
    ? 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg'
    : 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg'

  const sources: Record<string, object> = {
    'base': {
      type: 'raster',
      tiles: [baseUrl],
      tileSize: 256,
      maxzoom: baseLayer === 'luftbild' ? 20 : 18,
      attribution: '© swisstopo',
    },
    'terrain-dem': {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 15,
    },
  }

  const layers: object[] = [
    { id: 'base-layer', type: 'raster', source: 'base' },
  ]

  for (const o of OVERLAYS) {
    if (!o.url || !activeOverlays.includes(o.key)) continue
    sources[o.key] = { type: 'raster', tiles: [o.url], tileSize: 256, maxzoom: 18 }
    layers.push({ id: `${o.key}-layer`, type: 'raster', source: o.key, paint: { 'raster-opacity': o.opacity ?? 1 } })
  }

  return { version: 8 as const, sources, layers }
}

function DrawControlMount({ onReady }: { onReady: (draw: MapboxDraw) => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const draw = useControl<any>(() => new MapboxDraw({ displayControlsDefault: false, controls: {} }))
  useEffect(() => { onReady(draw) }, [draw, onReady])
  return null
}

function FlyToHandler({ onFlyTo }: { onFlyTo?: (handler: (lat: number, lng: number, zoom?: number) => void) => void }) {
  const { current: map } = useMap()
  useEffect(() => {
    if (!onFlyTo || !map) return
    onFlyTo((lat, lng, zoom) => {
      map.getMap().flyTo({ center: [lng, lat], zoom: zoom ?? map.getZoom(), duration: 1000 })
    })
  }, [map, onFlyTo])
  return null
}

function VineyardBoundaries({ vineyards, selectedVineyardId, panelVineyard, editingId, onBoundaryUpdated, drawRef, setDrawingMode, onPanelClose, onEditingChange }: {
  vineyards: Vineyard[]
  selectedVineyardId?: string | null
  panelVineyard: Vineyard | null
  editingId: string | null
  onBoundaryUpdated: () => void
  drawRef: React.RefObject<MapboxDraw | null>
  setDrawingMode: (mode: DrawingMode) => void
  onPanelClose: () => void
  onEditingChange: (id: string | null) => void
}) {
  const editFeatureIdRef = useRef<string | null>(null)

  const geojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: vineyards
      .filter(v => v.boundary && v.id !== editingId)
      .map(v => ({
        type: 'Feature' as const,
        id: v.id,
        properties: { id: v.id, name: v.name, selected: v.id === selectedVineyardId },
        geometry: v.boundary!,
      })),
  }), [vineyards, selectedVineyardId, editingId])

  async function handleEdit(v: Vineyard) {
    if (!v.boundary || !drawRef.current) return
    onPanelClose()
    setDrawingMode('none')
    const feature = { type: 'Feature' as const, properties: {}, geometry: v.boundary }
    const ids = drawRef.current.add(feature)
    const featureId = String(ids[0])
    editFeatureIdRef.current = featureId
    drawRef.current.changeMode('direct_select', { featureId })
    onEditingChange(v.id)
  }

  async function handleSave(v: Vineyard) {
    const draw = drawRef.current
    if (!draw || !editFeatureIdRef.current) return
    const all = draw.getAll()
    const feat = all.features.find(f => f.id === editFeatureIdRef.current)
    draw.deleteAll()
    editFeatureIdRef.current = null
    onEditingChange(null)
    if (feat?.geometry?.type === 'Polygon') {
      const boundary = feat.geometry as GeoJSONPolygon
      await updateVineyard(v.id, { name: v.name, description: v.description, boundary })
      onBoundaryUpdated()
    }
  }

  function handleCancel() {
    drawRef.current?.deleteAll()
    editFeatureIdRef.current = null
    onEditingChange(null)
  }

  const editingVineyard = editingId ? vineyards.find(v => v.id === editingId) ?? null : null

  return (
    <>
      <Source id="vineyards" type="geojson" data={geojson}>
        <Layer
          id="vineyard-fill"
          type="fill"
          paint={{
            'fill-color': ['case', ['==', ['get', 'selected'], true], '#15803d', '#6b7280'] as any,
            'fill-opacity': ['case', ['==', ['get', 'selected'], true], 0.15, 0.08] as any,
          }}
        />
        <Layer
          id="vineyard-border"
          type="line"
          paint={{
            'line-color': ['case', ['==', ['get', 'selected'], true], '#15803d', '#6b7280'] as any,
            'line-width': ['case', ['==', ['get', 'selected'], true], 2.5, 1.5] as any,
          }}
        />
        <Layer
          id="vineyard-label"
          type="symbol"
          layout={{ 'text-field': ['get', 'name'], 'text-size': 12, 'text-anchor': 'center' } as any}
          paint={{ 'text-color': '#374151', 'text-halo-color': '#fff', 'text-halo-width': 1 }}
        />
      </Source>

      {panelVineyard && (
        <VineyardActionPanel
          vineyard={panelVineyard}
          editing={editingId === panelVineyard.id}
          onEdit={() => handleEdit(panelVineyard)}
          onSave={() => { handleSave(panelVineyard); onPanelClose() }}
          onCancel={() => { handleCancel(); onPanelClose() }}
          onClose={onPanelClose}
        />
      )}
      {editingVineyard && !panelVineyard && (
        <VineyardActionPanel
          vineyard={editingVineyard}
          editing
          onEdit={() => {}}
          onSave={() => handleSave(editingVineyard)}
          onCancel={handleCancel}
          onClose={handleCancel}
        />
      )}
    </>
  )
}

function VineyardActionPanel({ vineyard, editing, onEdit, onSave, onCancel, onClose }: {
  vineyard: Vineyard
  editing: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onClose: () => void
}) {
  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute', bottom: 'var(--map-panel-bottom, 20px)', left: '50%', transform: 'translateX(-50%)',
        zIndex: 1000, background: '#fff', borderRadius: 8, padding: '10px 14px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: 10,
        fontSize: 13, whiteSpace: 'nowrap',
      }}
    >
      <strong>{vineyard.name}</strong>
      <span style={{ borderLeft: '1px solid #ddd', height: 20 }} />
      {editing ? (
        <>
          <button onClick={onSave} style={vBtnStyle('#16a34a')}>✓ Speichern</button>
          <button onClick={onCancel} style={vBtnStyle('#6b7280')}>Abbrechen</button>
        </>
      ) : (
        <>
          {vineyard.boundary && (
            <button onClick={onEdit} style={vBtnStyle('#1d4ed8')}>✎ Grenze bearbeiten</button>
          )}
          <button onClick={onClose} style={{ ...vBtnStyle('#6b7280'), padding: '3px 6px' }}>✕</button>
        </>
      )}
    </div>
  )
}

function vBtnStyle(bg: string): React.CSSProperties {
  return { background: bg, color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 500 }
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
  const [is3D, setIs3D] = useState(false)
  const [terrain, setTerrain] = useState<TerrainSpecification | undefined>(undefined)
  const [rows, setRows] = useState<Row[]>([])
  const [selectedVine, setSelectedVine] = useState<Vine | null>(null)
  const [elevationPopup, setElevationPopup] = useState<{ lat: number; lng: number; height: number } | null>(null)
  const [vineyardPanel, setVineyardPanel] = useState<Vineyard | null>(null)
  const [editingVineyardId, setEditingVineyardId] = useState<string | null>(null)
  const mapRef = useRef<MapRef>(null)
  const drawRef = useRef<MapboxDraw | null>(null)

  const mapStyle = useMemo(() => buildMapStyle(baseLayer, activeOverlays), [baseLayer, activeOverlays])

  const loadRows = useCallback(async () => {
    if (!selectedVineyardId) { setRows([]); return }
    const data = await listRows(selectedVineyardId)
    setRows(data)
  }, [selectedVineyardId])

  useEffect(() => { loadRows() }, [loadRows])

  function toggleOverlay(key: OverlayKey) {
    setActiveOverlays(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  function toggleGPS() {
    if (gpsActive) { stopWatching(); setGpsActive(false) }
    else { startWatching(); setGpsActive(true) }
  }

  function toggle3D() {
    const map = mapRef.current?.getMap()
    if (!map) return
    if (is3D) {
      setTerrain(undefined)
      map.easeTo({ pitch: 0, bearing: 0, duration: 800 })
      setIs3D(false)
    } else {
      setTerrain({ source: 'terrain-dem', exaggeration: 1.5 })
      map.easeTo({ pitch: 50, bearing: -15, duration: 800 })
      setIs3D(true)
    }
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

  function handleMapClick(e: MapLayerMouseEvent) {
    if (pickingLocation && onLocationPicked) {
      onLocationPicked({ type: 'Point', coordinates: [e.lngLat.lng, e.lngLat.lat] })
      return
    }

    // Vineyard feature click (via interactiveLayerIds)
    const features = e.features ?? []
    if (features.length > 0 && !editingVineyardId) {
      const vid = features[0].properties?.id
      const v = vineyards.find(x => x.id === vid)
      if (v) {
        if (v.id === selectedVineyardId) {
          setVineyardPanel(prev => prev?.id === v.id ? null : v)
        } else {
          setVineyardPanel(null)
          onVineyardClick?.(v)
        }
        return
      }
    }

    setVineyardPanel(null)

    // Elevation query
    if (activeOverlays.includes('hoehe')) {
      setElevationPopup(null)
      const [east, north] = wgs84ToLV95(e.lngLat.lat, e.lngLat.lng)
      fetch(`https://api3.geo.admin.ch/rest/services/height?easting=${east}&northing=${north}&sr=2056`)
        .then(r => r.json())
        .then(d => {
          const h = parseFloat(d.height)
          if (!isNaN(h)) setElevationPopup({ lat: e.lngLat.lat, lng: e.lngLat.lng, height: Math.round(h) })
        })
        .catch(() => {})
    }
  }

  return (
    <Box
      data-testid="vineyard-map"
      sx={{
        width: '100%', flex: 1, minHeight: 0, position: 'relative',
        cursor: pickingLocation ? 'crosshair' : undefined,
      }}
    >
      <Map
        ref={mapRef}
        initialViewState={{ longitude: center[1], latitude: center[0], zoom, pitch: 0, bearing: 0 }}
        mapStyle={mapStyle as any}
        maxZoom={22}
        terrain={terrain}
        interactiveLayerIds={['vineyard-fill']}
        onClick={handleMapClick}
        style={{ width: '100%', height: '100%' }}
      >
        <DrawControlMount onReady={draw => { drawRef.current = draw }} />
        <FlyToHandler onFlyTo={onFlyTo} />

        <VineyardBoundaries
          vineyards={vineyards}
          selectedVineyardId={selectedVineyardId}
          panelVineyard={vineyardPanel}
          editingId={editingVineyardId}
          onBoundaryUpdated={reloadVineyards}
          drawRef={drawRef}
          setDrawingMode={setDrawingMode}
          onPanelClose={() => setVineyardPanel(null)}
          onEditingChange={setEditingVineyardId}
        />

        {selectedVineyardId && (
          <RowLayer
            rows={rows}
            vineyardId={selectedVineyardId}
            onChanged={loadRows}
            onVineSelect={setSelectedVine}
            drawRef={drawRef}
          />
        )}

        <DrawingTools onDrawComplete={handleDrawComplete} drawRef={drawRef} />

        {tasks.filter(t => t.location).map(t => (
          <Marker
            key={t.id}
            longitude={t.location!.coordinates[0]}
            latitude={t.location!.coordinates[1]}
            onClick={() => onTaskSelect?.(t)}
          >
            <div style={{ width: 12, height: 12, background: '#f59e0b', borderRadius: '50%', border: '2px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.4)', cursor: 'pointer' }} />
          </Marker>
        ))}

        {position && (
          <Marker longitude={position.lng} latitude={position.lat}>
            <div style={{ width: 16, height: 16, background: '#1976d2', borderRadius: '50%', border: '2px solid white', opacity: 0.9 }} />
          </Marker>
        )}

        {elevationPopup && (
          <Marker longitude={elevationPopup.lng} latitude={elevationPopup.lat} anchor="bottom">
            <div onClick={e => e.stopPropagation()} style={{
              background: '#fff', padding: '4px 10px', borderRadius: 6,
              boxShadow: '0 1px 6px rgba(0,0,0,0.3)', fontSize: 13, fontWeight: 600,
              display: 'flex', gap: 6, alignItems: 'center',
            }}>
              {elevationPopup.height} m ü.M.
              <button onClick={() => setElevationPopup(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
            </div>
          </Marker>
        )}
      </Map>

      <Box sx={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {pickingLocation && (
          <Chip label="Standort wählen…" color="warning" size="small" icon={<AddLocationAltIcon />} sx={{ alignSelf: 'flex-end' }} />
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

        <Tooltip title={is3D ? '2D Ansicht' : '3D Ansicht'} placement="left">
          <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, boxShadow: 2 }}>
            <IconButton size="small" onClick={toggle3D} color={is3D ? 'primary' : 'default'} aria-label="3D Ansicht">
              <ViewInArIcon fontSize="small" />
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
