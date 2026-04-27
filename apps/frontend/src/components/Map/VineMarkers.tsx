import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import type { Vine } from '../../types'

const vineIcon = L.divIcon({
  className: 'vine-marker',
  html: '<div style="width:8px;height:8px;background:#15803d;border-radius:50%;border:2px solid white"></div>',
  iconSize: [8, 8],
  iconAnchor: [4, 4],
})

interface Props {
  vines: Vine[]
  onSelect?: (vine: Vine) => void
}

export default function VineMarkers({ vines, onSelect }: Props) {
  return (
    <>
      {vines
        .filter((v) => v.position)
        .map((v) => (
          <Marker
            key={v.id}
            position={[v.position!.coordinates[1], v.position!.coordinates[0]]}
            icon={vineIcon}
            eventHandlers={{ click: () => onSelect?.(v) }}
          >
            <Popup>
              <strong>Rebe {v.vineNumber}</strong>
              {v.notes && <p style={{ fontSize: 12, margin: '4px 0 0' }}>{v.notes}</p>}
            </Popup>
          </Marker>
        ))}
    </>
  )
}
