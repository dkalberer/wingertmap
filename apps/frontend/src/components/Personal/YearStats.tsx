import { Box, Typography, Table, TableBody, TableCell, TableHead, TableRow, useTheme } from '@mui/material'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { usePersonalStore } from '../../store/personalStore'

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

// Fixed palette for stacked employee bars (up to 8 employees)
const EMPLOYEE_COLORS = [
  '#5b8e3e', '#8b4f9e', '#c0392b', '#2471a3', '#d4a017', '#1a8a7a', '#e07b39', '#6c757d',
]

export default function YearStats() {
  const { stats, prevYearStats, year } = usePersonalStore()
  const theme = useTheme()

  // Monthly totals for current and previous year
  const currentTotals = Array(12).fill(0) as number[]
  for (const s of stats) s.months.forEach((h, i) => { currentTotals[i] += h })

  const prevTotals = Array(12).fill(0) as number[]
  for (const s of prevYearStats) s.months.forEach((h, i) => { prevTotals[i] += h })

  const colTotals = currentTotals
  const grandTotal = currentTotals.reduce((a, b) => a + b, 0)
  const hasPrevData = prevTotals.some((h) => h > 0)
  const hasCurrentData = currentTotals.some((h) => h > 0)

  // Data for comparison chart (current vs prev year)
  const comparisonData = MONTHS.map((m, i) => ({
    month: m,
    [year]: currentTotals[i] || null,
    [year - 1]: prevTotals[i] || null,
  }))

  // Data for employee stacked chart
  const employeeChartData = MONTHS.map((m, i) => {
    const entry: Record<string, string | number | null> = { month: m }
    for (const s of stats) {
      entry[s.employeeName] = s.months[i] || null
    }
    return entry
  })

  if (stats.length === 0 && !hasPrevData) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Noch keine Daten für {year}.
        </Typography>
      </Box>
    )
  }

  const chartHeight = 140
  const axisStyle = { fontSize: 11, fill: theme.palette.text.secondary }

  return (
    <Box>
      {/* ── Vergleich Vorjahr ───────────────────────────────────────── */}
      {(hasCurrentData || hasPrevData) && (
        <Box sx={{ px: 2, pt: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Stunden gesamt — {year} vs. {year - 1}
          </Typography>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={comparisonData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
              <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                formatter={(val) => [`${val} h`]}
                contentStyle={{ fontSize: 12, borderRadius: 6 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {hasPrevData && (
                <Bar dataKey={year - 1} fill={theme.palette.action.selected} radius={[3, 3, 0, 0]} />
              )}
              {hasCurrentData && (
                <Bar dataKey={year} fill="#5b8e3e" radius={[3, 3, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </Box>
      )}

      {/* ── Mitarbeiter-Aufteilung ──────────────────────────────────── */}
      {stats.length > 1 && hasCurrentData && (
        <Box sx={{ px: 2, pt: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Stunden nach Mitarbeiter — {year}
          </Typography>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={employeeChartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
              <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                formatter={(val) => [`${val} h`]}
                contentStyle={{ fontSize: 12, borderRadius: 6 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {stats.map((s, idx) => (
                <Bar
                  key={s.employeeId}
                  dataKey={s.employeeName}
                  stackId="emp"
                  fill={EMPLOYEE_COLORS[idx % EMPLOYEE_COLORS.length]}
                  radius={idx === stats.length - 1 ? [3, 3, 0, 0] : undefined}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Box>
      )}

      {/* ── Jahrestabelle ───────────────────────────────────────────── */}
      {stats.length > 0 && (
        <Box sx={{ overflow: 'auto', mt: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ px: 2, display: 'block' }}>
            Jahresauswertung {year}
          </Typography>
          <Table size="small" sx={{ minWidth: 500 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, pl: 2 }}>Mitarbeiter</TableCell>
                {MONTHS.map((m) => (
                  <TableCell key={m} align="right" sx={{ fontWeight: 700, px: 0.5, fontSize: '0.7rem' }}>{m}</TableCell>
                ))}
                <TableCell align="right" sx={{ fontWeight: 700, pr: 2 }}>Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stats.map((s) => (
                <TableRow key={s.employeeId}>
                  <TableCell sx={{ pl: 2, fontSize: '0.8rem' }}>{s.employeeName}</TableCell>
                  {s.months.map((h, i) => (
                    <TableCell key={i} align="right" sx={{ px: 0.5, fontSize: '0.75rem', color: h === 0 ? 'text.disabled' : 'inherit' }}>
                      {h === 0 ? '–' : h}
                    </TableCell>
                  ))}
                  <TableCell align="right" sx={{ fontWeight: 600, pr: 2, fontSize: '0.8rem' }}>{s.total}</TableCell>
                </TableRow>
              ))}
              <TableRow sx={{ borderTop: 2 }}>
                <TableCell sx={{ pl: 2, fontWeight: 700, fontSize: '0.8rem' }}>Total</TableCell>
                {colTotals.map((h, i) => (
                  <TableCell key={i} align="right" sx={{ px: 0.5, fontWeight: 600, fontSize: '0.75rem', color: h === 0 ? 'text.disabled' : 'inherit' }}>
                    {h === 0 ? '–' : h}
                  </TableCell>
                ))}
                <TableCell align="right" sx={{ fontWeight: 700, pr: 2, fontSize: '0.8rem' }}>{grandTotal}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  )
}
