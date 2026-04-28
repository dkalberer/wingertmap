import { useEffect, useRef } from 'react'
import { useMap } from 'react-map-gl/maplibre'
import MapboxDraw from 'maplibre-gl-draw'
import { useMapStore } from '../../store/mapStore'
import type { GeoJSONPolygon, GeoJSONLineString } from '../../types'

interface Props {
  onDrawComplete: (geometry: GeoJSONPolygon | GeoJSONLineString) => void
  drawRef: React.RefObject<MapboxDraw | null>
}

export default function DrawingTools({ onDrawComplete, drawRef }: Props) {
  const { current: map } = useMap()
  const { drawingMode, setDrawingMode } = useMapStore()
  const callbackRef = useRef(onDrawComplete)
  useEffect(() => { callbackRef.current = onDrawComplete }, [onDrawComplete])

  // Sync drawing mode to draw control
  useEffect(() => {
    const draw = drawRef.current
    if (!draw) return
    if (drawingMode === 'polygon') {
      draw.changeMode('draw_polygon')
    } else if (drawingMode === 'linestring') {
      draw.changeMode('draw_line_string')
    } else {
      try { draw.changeMode('simple_select') } catch {}
    }
  }, [drawingMode, drawRef])

  // Listen for draw.create events
  useEffect(() => {
    if (!map) return
    const rawMap = map.getMap()

    function onCreated(e: any) {
      const feature = e.features?.[0]
      if (!feature) return
      drawRef.current?.deleteAll()
      setDrawingMode('none')
      if (feature.geometry.type === 'Polygon') {
        callbackRef.current(feature.geometry as GeoJSONPolygon)
      } else if (feature.geometry.type === 'LineString') {
        callbackRef.current(feature.geometry as GeoJSONLineString)
      }
    }

    rawMap.on('draw.create', onCreated)
    return () => { rawMap.off('draw.create', onCreated) }
  }, [map, drawRef, setDrawingMode])

  return null
}
