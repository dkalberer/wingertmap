import { useState } from 'react'
import { Polyline, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet-draw'
import 'leaflet-draw/dist/leaflet.draw.css'
import { useEffect, useRef } from 'react'
import type { Row, Vine, GeoJSONLineString } from '../../types'
import { updateRowStatus, updateRowLine, deleteRow, confirmAllRows } from '../../api/rows'
import { listVines } from '../../api/vines'
import VineMarkers from './VineMarkers'

interface Props {
  rows: Row[]
  vineyardId: string
  onChanged: () => void
  onVineSelect?: (vine: Vine) => void
}

const PROPOSED_COLOR = '#f59e0b'  // amber
const CONFIRMED_COLOR = '#16a34a' // green

export default function RowLayer({ rows, vineyardId, onChanged, onVineSelect }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [vines, setVines] = useState<Vine[]>([])
  const map = useMap()

  useEffect(() => {
    if (rows.length === 0) { setVines([]); return }
    Promise.all(rows.map((r) => listVines(r.id))).then((results) => {
      setVines(results.flat())
    })
  }, [rows])

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
    if (!row.line) return
    setSelected(null)
    const coords: [number, number][] = row.line.coordinates.map(([lng, lat]) => [lat, lng])
    const poly = L.polyline(coords, { color: '#1d4ed8', weight: 3, dashArray: '6 4' }).addTo(map)

    const editHandler = new (L.EditToolbar.Edit as any)(map, {
      featureGroup: L.featureGroup([poly]),
    })
    editHandler.enable()

    map.once('click', async () => {
      editHandler.save()
      editHandler.disable()
      const edited = poly.getLatLngs() as L.LatLng[]
      map.removeLayer(poly)
      if (edited.length >= 2) {
        const line: GeoJSONLineString = {
          type: 'LineString',
          coordinates: edited.map((ll) => [ll.lng, ll.lat]),
        }
        await updateRowLine(row.id, line)
        onChanged()
      }
    })
  }

  const proposedCount = rows.filter((r) => r.status === 'proposed').length
  const selectedRow = rows.find((r) => r.id === selected)

  return (
    <>
      {rows.map((row) => {
        if (!row.line) return null
        const positions: [number, number][] = row.line.coordinates.map(([lng, lat]) => [lat, lng])
        const isSelected = selected === row.id
        const color = row.status === 'proposed' ? PROPOSED_COLOR : CONFIRMED_COLOR

        return (
          <Polyline
            key={row.id}
            positions={positions}
            pathOptions={{
              color: isSelected ? '#1d4ed8' : color,
              weight: isSelected ? 5 : 3,
              dashArray: row.status === 'proposed' ? '8 4' : undefined,
              opacity: 0.9,
            }}
            eventHandlers={{ click: () => setSelected(isSelected ? null : row.id) }}
          >
            <Tooltip>
              <span style={{ fontSize: 12 }}>
                <strong>Reihe {row.rowNumber}</strong>
                <span style={{ marginLeft: 6, color: row.status === 'proposed' ? '#d97706' : '#15803d' }}>
                  {row.status === 'proposed' ? '● Vorschlag' : '● Bestätigt'}
                </span>
              </span>
            </Tooltip>
          </Polyline>
        )
      })}

      {/* Floating action panel for selected row */}
      {selectedRow && (
        <RowActionPanel
          row={selectedRow}
          onConfirm={() => handleConfirm(selectedRow.id)}
          onEdit={() => handleEdit(selectedRow)}
          onDelete={() => handleDelete(selectedRow.id)}
          onClose={() => setSelected(null)}
        />
      )}

      {proposedCount > 0 && (
        <ConfirmAllControl count={proposedCount} onConfirmAll={handleConfirmAll} />
      )}

      <VineMarkers vines={vines} onSelect={onVineSelect} />
    </>
  )
}

function RowActionPanel({ row, onConfirm, onEdit, onDelete, onClose }: {
  row: Row
  onConfirm: () => void
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) {
      L.DomEvent.disableClickPropagation(ref.current)
    }
  }, [])

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
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
      {row.status === 'proposed' && (
        <button onClick={onConfirm} style={btnStyle('#16a34a')}>✓ Bestätigen</button>
      )}
      <button onClick={onEdit} style={btnStyle('#1d4ed8')}>✎ Bearbeiten</button>
      <button onClick={onDelete} style={btnStyle('#dc2626')}>✕ Löschen</button>
      <button onClick={onClose} style={{ ...btnStyle('#6b7280'), padding: '3px 6px' }}>✕</button>
    </div>
  )
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    background: bg, color: '#fff', border: 'none', borderRadius: 4,
    padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 500,
  }
}

function ConfirmAllControl({ count, onConfirmAll }: { count: number; onConfirmAll: () => void }) {
  const map = useMap()
  useEffect(() => {
    const CtrlClass = L.Control.extend({
      onAdd() {
        const div = L.DomUtil.create('div')
        div.style.cssText = 'background:#f59e0b;color:#fff;padding:6px 10px;border-radius:4px;cursor:pointer;font-size:13px;box-shadow:0 1px 4px rgba(0,0,0,0.3)'
        div.innerHTML = `✓ Alle ${count} Vorschläge bestätigen`
        L.DomEvent.on(div, 'click', (e) => {
          L.DomEvent.stopPropagation(e as unknown as L.LeafletMouseEvent)
          onConfirmAll()
        })
        return div
      },
    })
    const ctrl = new CtrlClass({ position: 'topright' })
    ctrl.addTo(map)
    return () => { ctrl.remove() }
  }, [count, map, onConfirmAll])
  return null
}
