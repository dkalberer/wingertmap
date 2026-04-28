import { useState, useEffect, useRef } from 'react'
import { Source, Layer, useMap } from 'react-map-gl/maplibre'
import MapboxDraw from 'maplibre-gl-draw'
import type { Row, Vine, GeoJSONLineString } from '../../types'
import { updateRowStatus, updateRowLine, deleteRow, confirmAllRows } from '../../api/rows'
import { listVines } from '../../api/vines'
import VineMarkers from './VineMarkers'

interface Props {
  rows: Row[]
  vineyardId: string
  onChanged: () => void
  onVineSelect?: (vine: Vine) => void
  drawRef: React.RefObject<MapboxDraw | null>
}

const PROPOSED_COLOR = '#f59e0b'
const CONFIRMED_COLOR = '#16a34a'

export default function RowLayer({ rows, vineyardId, onChanged, onVineSelect, drawRef }: Props) {
  const { current: map } = useMap()
  const [selected, setSelected] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const editFeatureIdRef = useRef<string | null>(null)
  const [vines, setVines] = useState<Vine[]>([])

  useEffect(() => {
    if (rows.length === 0) { setVines([]); return }
    Promise.all(rows.map(r => listVines(r.id))).then(results => setVines(results.flat()))
  }, [rows])

  const geojson = {
    type: 'FeatureCollection' as const,
    features: rows
      .filter(r => r.line && r.id !== editingId)
      .map(r => ({
        type: 'Feature' as const,
        id: r.id,
        properties: {
          id: r.id,
          rowNumber: r.rowNumber,
          status: r.status,
          selected: r.id === selected,
        },
        geometry: r.line!,
      })),
  }

  async function handleConfirm(id: string) {
    await updateRowStatus(id, 'confirmed')
    setSelected(null)
    onChanged()
  }

  async function handleDelete(id: string) {
    await deleteRow(id)
    setSelected(null)
    onChanged()
  }

  async function handleConfirmAll() {
    await confirmAllRows(vineyardId)
    onChanged()
  }

  function handleEdit(row: Row) {
    if (!row.line || !drawRef.current) return
    setSelected(null)
    const feature = { type: 'Feature' as const, properties: {}, geometry: row.line }
    const ids = drawRef.current.add(feature)
    const featureId = String(ids[0])
    editFeatureIdRef.current = featureId
    drawRef.current.changeMode('direct_select', { featureId })
    setEditingId(row.id)
  }

  async function handleSave(row: Row) {
    const draw = drawRef.current
    if (!draw || !editFeatureIdRef.current) return
    const all = draw.getAll()
    const feat = all.features.find(f => f.id === editFeatureIdRef.current)
    draw.deleteAll()
    editFeatureIdRef.current = null
    setEditingId(null)
    if (feat?.geometry?.type === 'LineString' && feat.geometry.coordinates.length >= 2) {
      const line: GeoJSONLineString = { type: 'LineString', coordinates: feat.geometry.coordinates as [number, number][] }
      await updateRowLine(row.id, line)
      onChanged()
    }
  }

  function handleCancel() {
    drawRef.current?.deleteAll()
    editFeatureIdRef.current = null
    setEditingId(null)
  }

  // Handle clicks on row features
  useEffect(() => {
    if (!map) return
    const rawMap = map.getMap()

    function onClick(e: any) {
      const features = rawMap.queryRenderedFeatures(e.point, { layers: ['rows-line', 'rows-casing'] })
      if (features.length > 0) {
        const id = features[0].properties?.id
        if (id) { setSelected(prev => prev === id ? null : id); return }
      }
      setSelected(null)
    }

    rawMap.on('click', onClick)
    return () => { rawMap.off('click', onClick) }
  }, [map])

  const proposedCount = rows.filter(r => r.status === 'proposed').length
  const selectedRow = rows.find(r => r.id === selected)
  const editingRow = rows.find(r => r.id === editingId)

  return (
    <>
      <Source id="rows" type="geojson" data={geojson}>
        <Layer
          id="rows-casing"
          type="line"
          paint={{
            'line-color': '#fff',
            'line-width': ['case', ['==', ['get', 'selected'], true], 7, 5],
            'line-opacity': 0.6,
          }}
        />
        <Layer
          id="rows-line"
          type="line"
          paint={{
            'line-color': ['case',
              ['==', ['get', 'selected'], true], '#1d4ed8',
              ['==', ['get', 'status'], 'proposed'], PROPOSED_COLOR,
              CONFIRMED_COLOR,
            ],
            'line-width': ['case', ['==', ['get', 'selected'], true], 5, 3],
            'line-dasharray': ['case', ['==', ['get', 'status'], 'proposed'], ['literal', [8, 4]], ['literal', [1, 0]]],
            'line-opacity': 0.9,
          }}
        />
      </Source>

      {selectedRow && !editingId && (
        <RowActionPanel
          row={selectedRow}
          onConfirm={() => handleConfirm(selectedRow.id)}
          onEdit={() => handleEdit(selectedRow)}
          onDelete={() => handleDelete(selectedRow.id)}
          onClose={() => setSelected(null)}
        />
      )}

      {editingRow && (
        <RowActionPanel
          row={editingRow}
          editing
          onConfirm={() => {}}
          onEdit={() => {}}
          onSave={() => handleSave(editingRow)}
          onCancel={handleCancel}
          onDelete={() => {}}
          onClose={handleCancel}
        />
      )}

      {proposedCount > 0 && !editingId && (
        <ConfirmAllButton count={proposedCount} onConfirmAll={handleConfirmAll} />
      )}

      <VineMarkers vines={vines} onSelect={onVineSelect} />
    </>
  )
}

function RowActionPanel({ row, editing, onConfirm, onEdit, onSave, onCancel, onDelete, onClose }: {
  row: Row
  editing?: boolean
  onConfirm: () => void
  onEdit: () => void
  onSave?: () => void
  onCancel?: () => void
  onDelete: () => void
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
      <strong>Reihe {row.rowNumber}</strong>
      <span style={{ color: row.status === 'proposed' ? '#d97706' : '#15803d', fontSize: 12 }}>
        {row.status === 'proposed' ? '● Vorschlag' : '● Bestätigt'}
      </span>
      <span style={{ borderLeft: '1px solid #ddd', height: 20 }} />
      {editing ? (
        <>
          <button onClick={onSave} style={btnStyle('#16a34a')}>✓ Speichern</button>
          <button onClick={onCancel} style={btnStyle('#6b7280')}>Abbrechen</button>
        </>
      ) : (
        <>
          {row.status === 'proposed' && (
            <button onClick={onConfirm} style={btnStyle('#16a34a')}>✓ Bestätigen</button>
          )}
          <button onClick={onEdit} style={btnStyle('#1d4ed8')}>✎ Bearbeiten</button>
          <button onClick={onDelete} style={btnStyle('#dc2626')}>✕ Löschen</button>
          <button onClick={onClose} style={{ ...btnStyle('#6b7280'), padding: '3px 6px' }}>✕</button>
        </>
      )}
    </div>
  )
}

function btnStyle(bg: string): React.CSSProperties {
  return { background: bg, color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 500 }
}

function ConfirmAllButton({ count, onConfirmAll }: { count: number; onConfirmAll: () => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onConfirmAll() }}
      style={{
        position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
        zIndex: 1000, background: '#f59e0b', color: '#fff', border: 'none',
        borderRadius: 4, padding: '6px 12px', cursor: 'pointer', fontSize: 13,
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)', whiteSpace: 'nowrap',
      }}
    >
      ✓ Alle {count} Vorschläge bestätigen
    </button>
  )
}
