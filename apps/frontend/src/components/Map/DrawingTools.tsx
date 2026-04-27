import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet-draw'
import 'leaflet-draw/dist/leaflet.draw.css'
import { useMapStore } from '../../store/mapStore'
import type { GeoJSONPolygon, GeoJSONLineString } from '../../types'

interface Props {
  onDrawComplete: (geometry: GeoJSONPolygon | GeoJSONLineString) => void
}

export default function DrawingTools({ onDrawComplete }: Props) {
  const map = useMap()
  const { drawingMode, setDrawingMode } = useMapStore()
  const callbackRef = useRef(onDrawComplete)
  useEffect(() => { callbackRef.current = onDrawComplete }, [onDrawComplete])

  useEffect(() => {
    console.log('[DrawingTools] drawingMode changed:', drawingMode)
    if (drawingMode === 'none') return

    console.log('[DrawingTools] enabling handler for', drawingMode)
    const drawnItems = new L.FeatureGroup()
    map.addLayer(drawnItems)

    let handler: L.Draw.Polygon | L.Draw.Polyline

    if (drawingMode === 'polygon') {
      handler = new L.Draw.Polygon(map as L.DrawMap, {
        shapeOptions: { color: '#15803d', weight: 3 },
      })
    } else {
      handler = new L.Draw.Polyline(map as L.DrawMap, {
        shapeOptions: { color: '#15803d', weight: 3 },
      })
    }
    handler.enable()
    console.log('[DrawingTools] handler enabled, waiting for draw:created')

    function onCreated(e: L.LeafletEvent) {
      console.log('[DrawingTools] draw:created fired', e)
      const event = e as unknown as L.DrawEvents.Created
      const layer = event.layer as L.Polygon | L.Polyline
      const geojson = layer.toGeoJSON()
      console.log('[DrawingTools] geometry:', geojson.geometry)

      if (geojson.geometry.type === 'Polygon') {
        callbackRef.current(geojson.geometry as GeoJSONPolygon)
      } else if (geojson.geometry.type === 'LineString') {
        callbackRef.current(geojson.geometry as GeoJSONLineString)
      }
      setDrawingMode('none')
    }

    map.on(L.Draw.Event.CREATED, onCreated)

    return () => {
      console.log('[DrawingTools] cleanup, disabling handler')
      handler.disable()
      map.off(L.Draw.Event.CREATED, onCreated)
      map.removeLayer(drawnItems)
    }
  }, [drawingMode, map, setDrawingMode])

  return null
}
