import type { WeatherData, PlantProtectionStatus } from '../types'

export async function getWeather(vineyardId: string): Promise<WeatherData> {
  const res = await fetch(`/api/vineyards/${vineyardId}/weather`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  })
  if (!res.ok) throw new Error('Wetterdaten konnten nicht geladen werden')
  return res.json()
}

export async function getProtectionStatus(vineyardId: string): Promise<PlantProtectionStatus> {
  const res = await fetch(`/api/vineyards/${vineyardId}/plant-protection-status`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  })
  if (!res.ok) throw new Error('Pflanzenschutz-Status konnte nicht geladen werden')
  return res.json()
}
