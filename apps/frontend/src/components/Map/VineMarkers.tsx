import { Marker } from 'react-map-gl/maplibre'
import type { Vine } from '../../types'

interface Props {
  vines: Vine[]
  onSelect?: (vine: Vine) => void
}

export default function VineMarkers({ vines, onSelect }: Props) {
  return (
    <>
      {vines
        .filter(v => v.position)
        .map(v => (
          <Marker
            key={v.id}
            longitude={v.position!.coordinates[0]}
            latitude={v.position!.coordinates[1]}
            onClick={() => onSelect?.(v)}
          >
            <div
              title={`Rebe ${v.vineNumber}${v.notes ? ` – ${v.notes}` : ''}`}
              style={{ width: 8, height: 8, background: '#15803d', borderRadius: '50%', border: '2px solid white', cursor: 'pointer' }}
            />
          </Marker>
        ))}
    </>
  )
}
