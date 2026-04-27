import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts'
import { Box, Typography } from '@mui/material'
import type { Harvest } from '../../types'

interface Props {
  harvests: Harvest[]
}

// Palette — rotiert durch Sorten
const PALETTE = ['#2196f3', '#e53935', '#43a047', '#fb8c00', '#8e24aa', '#00897b']

function colorFor(index: number): string {
  return PALETTE[index % PALETTE.length]
}

function dayOfYear(dateStr: string): number {
  const d = new Date(dateStr)
  const start = new Date(d.getFullYear(), 0, 0)
  return Math.floor((d.getTime() - start.getTime()) / 86400000)
}

export default function HarvestCharts({ harvests }: Props) {
  if (harvests.length === 0) return null

  // Unique years (ascending) and varieties
  const years = [...new Set(harvests.map((h) => new Date(h.harvestDate).getFullYear()))].sort()
  const varieties = [...new Map(harvests.map((h) => [h.varietyId, h.variety?.name ?? h.varietyId])).entries()]

  // Chart 1: Ertrag nach Jahr, gruppiert nach Sorte
  const ertragData = years.map((year) => {
    const row: Record<string, number | string> = { year }
    for (const [vid, vname] of varieties) {
      const entries = harvests.filter(
        (h) => new Date(h.harvestDate).getFullYear() === year && h.varietyId === vid,
      )
      row[vname] = entries.reduce((s, h) => s + h.weightKg, 0)
    }
    return row
  })

  // Chart 2: Oechsle-Entwicklung — avg Oechsle pro Sorte pro Jahr
  const oechsleVarieties = varieties.filter(([vid]) =>
    harvests.some((h) => h.varietyId === vid && h.oechsle != null),
  )
  const oechsleData = years.map((year) => {
    const row: Record<string, number | string> = { year }
    for (const [vid, vname] of oechsleVarieties) {
      const vals = harvests
        .filter((h) => new Date(h.harvestDate).getFullYear() === year && h.varietyId === vid && h.oechsle != null)
        .map((h) => h.oechsle!)
      if (vals.length > 0) {
        row[vname] = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)
      }
    }
    return row
  })

  // Chart 3: Erntedatum-Trend — frühestes Datum pro Jahr
  const datumData = years.map((year) => {
    const yearHarvests = harvests.filter((h) => new Date(h.harvestDate).getFullYear() === year)
    const earliest = yearHarvests.reduce(
      (min, h) => Math.min(min, dayOfYear(h.harvestDate)),
      400,
    )
    return { year, tag: earliest === 400 ? null : earliest }
  })

  const chartSx = { mt: 2 }

  return (
    <Box sx={{ px: 1 }}>
      <Box sx={chartSx}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
          Ertrag nach Jahr (kg)
        </Typography>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={ertragData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => (typeof v === 'number' ? `${v.toFixed(1)} kg` : v)} />
            {varieties.length > 1 && <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />}
            {varieties.map(([, vname], i) => (
              <Bar key={vname} dataKey={vname} stackId={undefined} fill={colorFor(i)} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Box>

      {oechsleVarieties.length > 0 && (
        <Box sx={chartSx}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
            Oechsle-Entwicklung
          </Typography>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={oechsleData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="°" />
              <Tooltip formatter={(v) => (typeof v === 'number' ? `${v}°Oe` : v)} />
              {oechsleVarieties.length > 1 && <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />}
              {oechsleVarieties.map(([, vname], i) => (
                <Line key={vname} dataKey={vname} stroke={colorFor(i)} dot strokeWidth={2} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Box>
      )}

      {datumData.some((d) => d.tag != null) && (
        <Box sx={chartSx}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
            Erntedatum-Trend (Kalendertag)
          </Typography>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={datumData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
              <Tooltip formatter={(v) => (typeof v === 'number' ? `Tag ${v}` : v)} />
              <Line dataKey="tag" stroke={PALETTE[0]} dot strokeWidth={2} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Box>
  )
}
