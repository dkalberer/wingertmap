import type { WeatherData, PlantProtectionStatus } from '../types'
import { getDiseaseRisk } from './protection'

export async function getWeather(vineyardId: string): Promise<WeatherData> {
  const res = await fetch(`/api/vineyards/${vineyardId}/weather`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  })
  if (!res.ok) throw new Error('Wetterdaten konnten nicht geladen werden')
  return res.json()
}

const AGGREGATE_KEYS = new Set(['mildiou', 'oidium', 'black-rot', 'botrytis', 'acariose'])

export async function getProtectionStatus(vineyardId: string): Promise<PlantProtectionStatus> {
  const risk = await getDiseaseRisk(vineyardId)
  const relevant = risk.diseases.filter((d) => AGGREGATE_KEYS.has(d.key))
  const rank: Record<string, number> = { rot: 0, gelb: 1, grün: 2, '': 3 }
  const worst = [...relevant].sort((a, b) => rank[a.effectiveLevel] - rank[b.effectiveLevel])[0]

  let lastSprayDate: string | null = null
  let daysSinceSpray: number | null = null
  for (const d of risk.diseases) {
    if (d.measureType === 'spray' && d.lastMeasureAt) {
      const sprayDate = new Date(d.lastMeasureAt)
      if (!lastSprayDate || sprayDate > new Date(lastSprayDate)) {
        lastSprayDate = d.lastMeasureAt.slice(0, 10)
        daysSinceSpray = Math.round((Date.now() - sprayDate.getTime()) / 86400000)
      }
    }
  }

  return {
    lastSprayDate,
    daysSinceSpray,
    protectionPct: daysSinceSpray !== null ? Math.max(0, 100 - Math.round((daysSinceSpray / 12) * 100)) : 0,
    level: (worst?.effectiveLevel || 'rot') as PlantProtectionStatus['level'],
  }
}
