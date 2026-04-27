import type { GeoJSONPolygon } from '../types'

export function polygonCenter(boundary: GeoJSONPolygon): [number, number] {
  const coords = boundary.coordinates[0]
  let lat = 0, lng = 0
  for (const [lo, la] of coords) { lng += lo; lat += la }
  return [lat / coords.length, lng / coords.length]
}
