import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Typography, Box,
} from '@mui/material'
import type { PruningRecord, Harvest, SchnittTyp } from '../../types'

interface Props {
  records: PruningRecord[]
  harvests: Harvest[]
}

interface CorrelationRow {
  year: number
  schnittTyp: SchnittTyp | null
  augenProRebe: number | null
  totalKg: number | null
  avgOechsle: number | null
}

const SCHNITT_COLOR: Record<SchnittTyp, 'default' | 'primary' | 'secondary' | 'info'> = {
  Bogenschnitt:   'primary',
  Zapfenschnitt:  'info',
  Minimalschnitt: 'secondary',
  Sonstiges:      'default',
}

function buildRows(records: PruningRecord[], harvests: Harvest[]): CorrelationRow[] {
  const years = new Set<number>()
  records.forEach((r) => years.add(r.year))
  harvests.forEach((h) => years.add(new Date(h.harvestDate).getFullYear()))

  return [...years].sort((a, b) => b - a).map((year) => {
    const pruning = records.find((r) => r.year === year) ?? null
    const yearHarvests = harvests.filter((h) => new Date(h.harvestDate).getFullYear() === year)
    const totalKg = yearHarvests.length > 0
      ? yearHarvests.reduce((sum, h) => sum + h.weightKg, 0)
      : null
    const oechsleValues = yearHarvests.flatMap((h) => h.oechsle != null ? [h.oechsle] : [])
    const avgOechsle = oechsleValues.length > 0
      ? oechsleValues.reduce((sum, v) => sum + v, 0) / oechsleValues.length
      : null

    return {
      year,
      schnittTyp: pruning?.schnittTyp ?? null,
      augenProRebe: pruning?.augenProRebe ?? null,
      totalKg,
      avgOechsle,
    }
  })
}

export default function PruningCorrelationTable({ records, harvests }: Props) {
  const rows = buildRows(records, harvests)

  if (rows.length === 0) return null

  return (
    <Box>
      <Typography variant="overline" color="text.secondary" component="p" sx={{ mb: 0.5 }}>
        Schnitt–Ernte Übersicht
      </Typography>
      <TableContainer>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Jahrgang</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Schnitttyp</TableCell>
              <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Augen/Rebe</TableCell>
              <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Ertrag kg</TableCell>
              <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Ø Oechsle</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.year} hover>
                <TableCell sx={{ fontWeight: 600 }}>{row.year}</TableCell>
                <TableCell>
                  {row.schnittTyp
                    ? <Chip label={row.schnittTyp} size="small" color={SCHNITT_COLOR[row.schnittTyp]} />
                    : <Typography variant="caption" color="text.disabled">—</Typography>}
                </TableCell>
                <TableCell>
                  {row.augenProRebe != null
                    ? row.augenProRebe.toFixed(1)
                    : <Typography variant="caption" color="text.disabled">—</Typography>}
                </TableCell>
                <TableCell>
                  {row.totalKg != null
                    ? `${row.totalKg.toFixed(1)} kg`
                    : <Typography variant="caption" color="text.disabled">—</Typography>}
                </TableCell>
                <TableCell>
                  {row.avgOechsle != null
                    ? `${Math.round(row.avgOechsle)}°Oe`
                    : <Typography variant="caption" color="text.disabled">—</Typography>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
