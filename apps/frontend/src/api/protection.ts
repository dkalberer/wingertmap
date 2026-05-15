import type { DiseaseRiskResponse, DiseaseSeriesResponse } from '../types'

export async function getDiseaseRisk(vineyardId: string): Promise<DiseaseRiskResponse> {
  const res = await fetch(`/api/vineyards/${vineyardId}/disease-risk`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  })
  if (!res.ok) throw new Error('Krankheitsrisiko konnte nicht geladen werden')
  return res.json()
}

export async function getDiseaseSeries(
  vineyardId: string,
  diseaseKey: string,
  from: string,
  to: string,
): Promise<DiseaseSeriesResponse> {
  const res = await fetch(
    `/api/vineyards/${vineyardId}/disease-risk/${encodeURIComponent(diseaseKey)}/series?from=${from}&to=${to}`,
    { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } },
  )
  if (!res.ok) throw new Error('Krankheits-Zeitreihe konnte nicht geladen werden')
  return res.json()
}
