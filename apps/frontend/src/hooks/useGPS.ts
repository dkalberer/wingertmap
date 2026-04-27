import { useState, useEffect } from 'react'

interface GPSPosition {
  lat: number
  lng: number
  accuracy: number
}

export function useGPS() {
  const [position, setPosition] = useState<GPSPosition | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [watching, setWatching] = useState(false)

  useEffect(() => {
    if (!watching) return
    if (!navigator.geolocation) {
      setError('Geolocation wird nicht unterstützt')
      return
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => setPosition({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      (err) => setError(err.message),
      { enableHighAccuracy: true },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [watching])

  return { position, error, startWatching: () => setWatching(true), stopWatching: () => setWatching(false) }
}
