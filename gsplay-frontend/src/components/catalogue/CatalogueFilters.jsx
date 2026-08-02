import { Button, FormControl, MenuItem, Select, Stack, Typography } from '@mui/material'

function Facet({ title, values, selected, onChange }) {
  const safeValues = Array.isArray(values) ? values : []
  const safeSelected = Array.isArray(selected) ? selected : []

  return (
    <Stack spacing={1}>
      <Typography className="pixel-label" color="primary">
        {title}
      </Typography>
      <FormControl fullWidth size="small">
        <Select
          multiple
          displayEmpty
          value={safeSelected}
          onChange={(event) => onChange(event.target.value)}
          renderValue={(items) =>
            items.length
              ? `${items.length} selezionat${items.length === 1 ? 'o' : 'i'}`
              : `Scegli ${title.toLowerCase()}`
          }
        >
          <MenuItem disabled value="">
            Scegli {title.toLowerCase()}
          </MenuItem>
          {safeValues.map((value) => (
            <MenuItem key={value} value={value}>
              {value}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  )
}

export default function CatalogueFilters({ facets, genres, platforms, gameModes, onChange }) {
  return (
    <Stack spacing={3}>
      <Facet title="GENERI" values={facets.genres} selected={genres} onChange={onChange.genres} />
      <Facet
        title="PIATTAFORME"
        values={facets.platforms}
        selected={platforms}
        onChange={onChange.platforms}
      />
      <Facet
        title="MODALITÀ DI GIOCO"
        values={facets.gameModes}
        selected={gameModes}
        onChange={onChange.gameModes}
      />
      <Button variant="text" onClick={onChange.clear}>
        Leva tutto, daje
      </Button>
    </Stack>
  )
}
