import { useEffect, useState } from 'react'
import { Autocomplete, CircularProgress, TextField } from '@mui/material'
import { awardsApi } from '../../services/api'

export default function AwardsGameSearch({ category, selected, onChange, disabled }) {
  const [input, setInput] = useState('')
  const [options, setOptions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setError('')
    setOptions([])
    setLoading(input.trim().length >= 3)
    const timer = setTimeout(async () => {
      if (input.trim().length < 3) return
      try {
        const response = await awardsApi.search(input.trim())
        if (active) setOptions(response.games)
      } catch {
        if (active) setError('Aò, la ricerca s’è impicciata. Riprova fra poco.')
      } finally {
        if (active) setLoading(false)
      }
    }, 300)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [input])
  return (
    <Autocomplete
      multiple
      disabled={disabled}
      value={selected}
      options={options}
      loading={loading}
      filterOptions={(rows) => rows}
      filterSelectedOptions
      isOptionEqualToValue={(a, b) => a.igdbId === b.igdbId}
      getOptionLabel={(game) => game.title}
      getOptionDisabled={(game) =>
        selected.length >= 4 && !selected.some((item) => item.igdbId === game.igdbId)
      }
      onChange={(_, games) => onChange(games.slice(0, 4))}
      onInputChange={(_, value) => setInput(value)}
      noOptionsText={
        input.trim().length < 3
          ? 'Scrivi almeno 3 caratteri, su.'
          : error || 'Nun trovo niente. Prova co’ un altro titolo.'
      }
      renderOption={(props, game) => (
        <li {...props} key={game.igdbId}>
          {game.title}
          {game.platforms?.length ? ` · ${game.platforms.join(', ')}` : ''}
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={`Cerca giochi per ${category.name}`}
          helperText={
            error ||
            `${selected.length}/4 scelti · qualsiasi piattaforma, pure fuori dalla libreria.`
          }
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading && <CircularProgress size={18} />}
                {params.InputProps.endAdornment}
              </>
            )
          }}
        />
      )}
    />
  )
}
