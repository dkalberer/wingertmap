import { Box, Typography, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material'
import { usePersonalStore } from '../../store/personalStore'

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

export default function YearStats() {
  const { stats, year } = usePersonalStore()

  if (stats.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Noch keine Daten für {year}.
        </Typography>
      </Box>
    )
  }

  const colTotals = Array(12).fill(0) as number[]
  for (const s of stats) {
    s.months.forEach((h, i) => { colTotals[i] += h })
  }
  const grandTotal = colTotals.reduce((a, b) => a + b, 0)

  return (
    <Box sx={{ overflow: 'auto' }}>
      <Typography variant="caption" color="text.secondary" sx={{ px: 2, pt: 1.5, display: 'block' }}>
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
  )
}
