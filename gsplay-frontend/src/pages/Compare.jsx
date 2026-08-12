import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Grid,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined'
import { libraryApi } from '../services/api'
import { useLoad } from '../hooks/useLoad'

const PAGE_SIZE = 24

function MultiSelect({ label, values, selected, onChange, disabled = false }) {
  return (
    <FormControl fullWidth size="small" disabled={disabled}>
      <Typography className="pixel-label" color="primary" sx={{ mb: 1 }}>
        {label}
      </Typography>
      <Select
        multiple
        displayEmpty
        value={selected}
        inputProps={{ 'aria-label': label }}
        onChange={(event) => onChange(event.target.value)}
        renderValue={(items) =>
          items.length ? `${items.length} scelt${items.length === 1 ? 'o' : 'i'}` : 'Tutti'
        }
      >
        {values.map((value) => {
          const id = typeof value === 'string' ? value : value.id
          const display = typeof value === 'string' ? value : value.label
          return (
            <MenuItem key={id} value={id}>
              <Checkbox size="small" checked={selected.includes(id)} />
              {display}
            </MenuItem>
          )
        })}
      </Select>
    </FormControl>
  )
}

function ComparisonCard({ game, showCount }) {
  return (
    <Card
      component={game.igdbUrl ? 'a' : 'article'}
      href={game.igdbUrl || undefined}
      target={game.igdbUrl ? '_blank' : undefined}
      rel={game.igdbUrl ? 'noreferrer' : undefined}
      className={`game-card${game.igdbUrl ? ' game-card--interactive' : ''}${game.artwork ? ' game-card--cover' : ''}`}
      sx={{
        display: 'flex',
        minHeight: 250,
        textDecoration: 'none',
        backgroundImage: game.artwork ? `url(${JSON.stringify(game.artwork)})` : undefined
      }}
    >
      <CardContent sx={{ width: '100%', alignSelf: 'flex-end' }}>
        <Stack spacing={1.25}>
          <Typography variant="h6" className="game-title-clamp">
            {game.title}
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            {game.genres.slice(0, 2).map((genre) => (
              <Chip key={genre} size="small" label={genre} />
            ))}
            {game.multiplayerModes.slice(0, 2).map((mode) => (
              <Chip key={mode.id} size="small" color="primary" variant="outlined" label={mode.label} />
            ))}
          </Stack>
          <Stack direction="row" spacing={0.75} alignItems="flex-start">
            <PeopleAltOutlinedIcon color="primary" fontSize="small" sx={{ mt: 0.2 }} />
            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
              {showCount && (
                <Typography variant="body2" color="primary" fontWeight={800}>
                  Ce l’hanno {game.ownerCount} su {game.selectedUserCount}
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary">
                {game.owners.map((owner) => owner.username).join(', ')}
              </Typography>
            </Stack>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}

export default function Compare() {
  const people = useLoad(libraryApi.users, [])
  const [selected, setSelected] = useState([])
  const [genres, setGenres] = useState([])
  const [multiplayerOnly, setMultiplayerOnly] = useState(false)
  const [multiplayerModes, setMultiplayerModes] = useState([])
  const [page, setPage] = useState(1)
  const [result, setResult] = useState()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const userIds = useMemo(() => selected.map((person) => person.id), [selected])
  const queryKey = JSON.stringify({ userIds, genres, multiplayerOnly, multiplayerModes })

  useEffect(() => {
    if (selected.length < 2) {
      setResult(undefined)
      setLoading(false)
      return undefined
    }
    let active = true
    const timer = setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const response = await libraryApi.compare({
          userIds,
          genres,
          multiplayerOnly,
          multiplayerModes,
          page,
          pageSize: PAGE_SIZE
        })
        if (active)
          setResult((current) => ({
            ...response,
            games: page === 1 ? response.games : [...(current?.games || []), ...response.games]
          }))
      } catch (err) {
        if (active) setError(err.message)
      } finally {
        if (active) setLoading(false)
      }
    }, 200)
    return () => {
      active = false
      clearTimeout(timer)
    }
    // queryKey intentionally captures all arrays by value rather than identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, page])

  const resetQuery = (change) => {
    setPage(1)
    change()
  }
  const clearFilters = () =>
    resetQuery(() => {
      setGenres([])
      setMultiplayerOnly(false)
      setMultiplayerModes([])
    })
  const choosePeople = (values) => {
    setSelected(values.slice(0, 10))
    setGenres([])
    setMultiplayerOnly(false)
    setMultiplayerModes([])
    setPage(1)
    setResult(undefined)
  }
  const showCount = selected.length > 2
  const hasFilters = genres.length || multiplayerOnly || multiplayerModes.length

  return (
    <Stack spacing={{ xs: 2.5, md: 3.5 }}>
      <Stack spacing={0.75}>
        <Typography variant="h2">Confronta le libbrerie</Typography>
        <Typography color="text.secondary">
          Scegli almeno due compari: troviamo li giochi che c’hanno in comune a coppie, terzetti o
          intere legioni. Più proprietari stanno sopra, com’è giusto in Senato.
        </Typography>
      </Stack>
      <Card>
        <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}>
          <Autocomplete
            multiple
            options={people.data?.users || []}
            value={selected}
            onChange={(_, values) => choosePeople(values)}
            getOptionLabel={(person) => person.username}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => (
              <TextField {...params} label="Cerca compari" placeholder="Da due a dieci, senza ressa" />
            )}
            renderTags={() => null}
          />
          <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 2 }}>
            {selected.map((person) => (
              <Chip
                key={person.id}
                label={person.username}
                color="primary"
                onDelete={() => choosePeople(selected.filter((item) => item.id !== person.id))}
              />
            ))}
          </Stack>
        </CardContent>
      </Card>

      {selected.length > 0 && selected.length < 2 && (
        <Alert severity="info">Serve almeno un altro compare. Da soli è inventario, mica confronto.</Alert>
      )}

      {selected.length >= 2 && result && (
        <Card component="section" aria-label="Filtri confronto">
          <CardContent>
            <Grid container spacing={2} alignItems="end">
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <MultiSelect
                  label="GENERI"
                  values={result.facets.genres}
                  selected={genres}
                  onChange={(values) => resetQuery(() => setGenres(values))}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <MultiSelect
                  label="MODALITÀ MULTIGIOCATORE"
                  values={result.facets.multiplayerModes}
                  selected={multiplayerModes}
                  disabled={!multiplayerOnly}
                  onChange={(values) => resetQuery(() => setMultiplayerModes(values))}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Stack spacing={1} alignItems={{ md: 'flex-start' }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={multiplayerOnly}
                        onChange={(event) =>
                          resetQuery(() => {
                            setMultiplayerOnly(event.target.checked)
                            if (!event.target.checked) setMultiplayerModes([])
                          })
                        }
                      />
                    }
                    label="Solo multigiocatore"
                  />
                  {Boolean(hasFilters) && (
                    <Button size="small" onClick={clearFilters}>Leva tutti li filtri</Button>
                  )}
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {(people.loading || (loading && !result)) && (
        <Box sx={{ py: 5, textAlign: 'center' }}>
          <CircularProgress aria-label="Confronto in corso" />
        </Box>
      )}
      {error && <Alert severity="error">Aò, il confronto s’è messo de traverso: riprova.</Alert>}

      {selected.length >= 2 && result && (
        <Stack spacing={2}>
          <Typography variant="h6">
            {result.page.total} giochi possibili: almeno due de voi ce l’hanno. Mo’ scegliete senza
            convocà un concilio.
          </Typography>
          {!result.games.length ? (
            <Typography color="text.secondary">
              Qua nun combacia niente{hasFilters ? ' co’ sti filtri' : ''}. Allarga le maglie o
              preparate er portafoglio.
            </Typography>
          ) : (
            <Grid container spacing={2}>
              {result.games.map((game) => (
                <Grid key={game.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <ComparisonCard game={game} showCount={showCount} />
                </Grid>
              ))}
            </Grid>
          )}
          {result.page.hasMore && (
            <Button
              variant="outlined"
              disabled={loading}
              onClick={() => setPage((value) => value + 1)}
              sx={{ alignSelf: 'center' }}
            >
              {loading ? 'Sto a cercà…' : 'Caricane altri'}
            </Button>
          )}
        </Stack>
      )}
    </Stack>
  )
}
