import { useEffect, useState } from 'react'
import { Autocomplete, Box, Chip, CircularProgress, TextField, Typography } from '@mui/material'
import type { PsmProduct, PsmSubstance, SprayPayload } from '../../types'
import { getProduct, searchProducts } from '../../api/psm'

interface Props {
  value: SprayPayload
  onChange: (next: SprayPayload) => void
}

interface EnrichedProduct {
  id: string
  name: string
  substances: PsmSubstance[]
  pestIds: string[]
  pestNames: Map<string, string>
  dosageHint?: string
}

export default function SprayFields({ value, onChange }: Props) {
  const [options, setOptions] = useState<PsmProduct[]>([])
  const [query, setQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [selected, setSelected] = useState<EnrichedProduct[]>([])

  useEffect(() => {
    if (query.length < 1) { setOptions([]); return }
    let cancelled = false
    setSearchLoading(true)
    searchProducts(query)
      .then((p) => { if (!cancelled) setOptions(p) })
      .catch(() => { if (!cancelled) setOptions([]) })
      .finally(() => { if (!cancelled) setSearchLoading(false) })
    return () => { cancelled = true }
  }, [query])

  async function addProduct(p: PsmProduct | null) {
    if (!p) return
    if (selected.find((s) => s.id === p.id)) return
    const full = await getProduct(p.id).catch(() => null)
    if (!full) return
    const pestNames = new Map<string, string>()
    for (const ind of full.indications ?? []) {
      if (ind.pestName) pestNames.set(ind.pestId, ind.pestName)
    }
    const ep: EnrichedProduct = {
      id: full.id,
      name: full.name,
      substances: full.substances ?? [],
      pestIds: Array.from(new Set((full.indications ?? []).map((i) => i.pestId))),
      pestNames,
      dosageHint: full.indications?.[0]?.dosageFrom != null
        ? `${full.indications[0].dosageFrom} ${full.indications[0].dosageUnit ?? ''}`
        : undefined,
    }
    const next = [...selected, ep]
    emitSelection(next)
  }

  function removeProduct(id: string) {
    const next = selected.filter((s) => s.id !== id)
    emitSelection(next)
  }

  function emitSelection(next: EnrichedProduct[]) {
    setSelected(next)
    const substanceIds = Array.from(new Set(next.flatMap((s) => s.substances.map((x) => x.id))))
    const targetPestIds = Array.from(new Set(next.flatMap((s) => s.pestIds)))
    onChange({
      ...value,
      productIds: next.map((s) => s.id),
      substanceIds,
      targetPestIds,
    })
  }

  const allSubstances = new Map<string, string>()
  for (const sp of selected) for (const s of sp.substances) allSubstances.set(s.id, s.nameDe)
  const allPests = new Map<string, string>()
  for (const sp of selected) for (const pid of sp.pestIds) {
    allPests.set(pid, sp.pestNames.get(pid) ?? pid)
  }
  const firstDosageHint = selected.find((s) => s.dosageHint)?.dosageHint

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Autocomplete
        options={options}
        getOptionLabel={(o) => o.name}
        filterOptions={(x) => x}
        loading={searchLoading}
        loadingText="Suche…"
        noOptionsText={query.length === 0 ? 'Tippen, um Produkte zu suchen' : 'Keine Produkte gefunden — PSM-Sync ggf. nicht abgeschlossen?'}
        onInputChange={(_, v) => setQuery(v)}
        onChange={(_, v) => { void addProduct(v) }}
        value={null}
        blurOnSelect
        renderInput={(params) => (
          <TextField
            {...params}
            label="Produkt hinzufügen"
            size="small"
            placeholder="Aktuan, Folpan, Kumulus, …"
            slotProps={{
              ...params.slotProps,
              input: {
                ...params.slotProps.input,
                endAdornment: (
                  <>
                    {searchLoading ? <CircularProgress color="inherit" size={16} /> : null}
                    {params.slotProps.input.endAdornment}
                  </>
                ),
              },
            }}
          />
        )}
      />

      {selected.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary">
            Gewählte Produkte ({selected.length}{selected.length > 1 ? ' · Tankmischung' : ''})
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
            {selected.map((s) => (
              <Chip key={s.id} label={s.name} onDelete={() => removeProduct(s.id)} size="small" />
            ))}
          </Box>
        </Box>
      )}

      {allSubstances.size > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary">
            Wirkstoffe ({allSubstances.size})
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
            {Array.from(allSubstances).map(([id, name]) => (
              <Chip key={id} label={name} size="small" />
            ))}
          </Box>
        </Box>
      )}

      {allPests.size > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary">Wirkt gegen</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
            {Array.from(allPests).map(([id, name]) => (
              <Chip key={id} label={name} size="small" color="success" />
            ))}
          </Box>
        </Box>
      )}

      <TextField
        label="Dosierung"
        type="number"
        size="small"
        slotProps={{ htmlInput: { step: 0.001 } }}
        value={value.dosage ?? ''}
        onChange={(e) => onChange({
          ...value,
          dosage: e.target.value ? Number(e.target.value) : undefined,
        })}
        helperText={firstDosageHint ? `Empfohlen (erstes Produkt): ${firstDosageHint}` : ''}
      />
    </Box>
  )
}
