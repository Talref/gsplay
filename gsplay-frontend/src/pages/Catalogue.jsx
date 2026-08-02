import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Drawer,
  FormControl,
  Grid,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import FilterAltIcon from '@mui/icons-material/FilterAlt'
import CatalogueFilters from '../components/catalogue/CatalogueFilters'
import CatalogueGameCard from '../components/catalogue/CatalogueGameCard'
import CatalogueSuggestions from '../components/catalogue/CatalogueSuggestions'
import useInfiniteScroll from '../hooks/useInfiniteScroll'
import { catalogueApi } from '../services/api'

const toggle = (items, item) =>
  items.includes(item) ? items.filter((value) => value !== item) : [...items, item]
export default function Catalogue() {
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [sort, setSort] = useState('rating')
  const [genres, setGenres] = useState([])
  const [platforms, setPlatforms] = useState([])
  const [gameModes, setGameModes] = useState([])
  const [games, setGames] = useState([])
  const [page, setPage] = useState({ number: 0, size: 24, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [facets, setFacets] = useState({ genres: [], platforms: [], gameModes: [] })
  const [drawerOpen, setDrawerOpen] = useState(false)
  const options = useMemo(
    () => ({ query: appliedQuery, sort, genres, platforms, gameModes, pageSize: page.size }),
    [appliedQuery, gameModes, genres, page.size, platforms, sort]
  )
  const load = useCallback(
    async (nextPage, replace = false) => {
      setLoading(true)
      setError('')
      try {
        const response = await catalogueApi.games({ ...options, page: nextPage })
        setGames((current) => (replace ? response.games : [...current, ...response.games]))
        setPage(response.page)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    },
    [options]
  )
  useEffect(() => {
    catalogueApi
      .filters()
      .then((response) =>
        setFacets({
          genres: Array.isArray(response?.genres) ? response.genres : [],
          platforms: Array.isArray(response?.platforms) ? response.platforms : [],
          gameModes: Array.isArray(response?.gameModes) ? response.gameModes : []
        })
      )
      .catch((err) => setError(err.message))
  }, [])
  useEffect(() => {
    const timer = setTimeout(() => load(1, true), 200)
    return () => clearTimeout(timer)
  }, [load])
  useEffect(() => {
    if (query.trim().length < 3 || query.trim() === appliedQuery) {
      setSuggestions([])
      return undefined
    }
    const timer = setTimeout(
      () =>
        catalogueApi
          .games({ query, pageSize: 5, sort: 'rating' })
          .then((response) => setSuggestions(response.games))
          .catch(() => setSuggestions([])),
      220
    )
    return () => clearTimeout(timer)
  }, [appliedQuery, query])
  const hasMore = games.length < page.total
  const loadMore = useCallback(() => load(page.number + 1), [load, page.number])
  const sentinel = useInfiniteScroll({ hasMore, loading, onLoadMore: loadMore })
  const applySearch = (value = query) => {
    setQuery(value)
    setAppliedQuery(value)
    setSuggestions([])
  }
  const clearFilters = () => {
    setGenres([])
    setPlatforms([])
    setGameModes([])
  }
  const activeFilters = [
    ['Genere', genres, setGenres],
    ['Piattaforma', platforms, setPlatforms],
    ['Modalità', gameModes, setGameModes]
  ]
  const filterProps = {
    facets,
    genres,
    platforms,
    gameModes,
    onChange: {
      genres: setGenres,
      platforms: setPlatforms,
      gameModes: setGameModes,
      clear: clearFilters
    }
  }
  return (
    <Stack spacing={3}>
      <Box textAlign={{ xs: 'left', md: 'center' }}>
        <Typography variant="h2">SCAVA NER CATALOGO</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Cerca er prossimo gioco da comprà e lascià lì a prende polvere.
        </Typography>
      </Box>
      <Box sx={{ position: 'relative' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
          <TextField
            fullWidth
            label="Cerca un gioco"
            placeholder="Almeno tre lettere, fratè"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && applySearch()}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="primary" />
                </InputAdornment>
              )
            }}
          />
          <Button variant="contained" onClick={() => applySearch()}>
            Cerca
          </Button>
          <Button
            variant="outlined"
            startIcon={<FilterAltIcon />}
            sx={{ display: { md: 'none' } }}
            onClick={() => setDrawerOpen(true)}
          >
            Filtri
          </Button>
        </Stack>
        <CatalogueSuggestions games={suggestions} onSelect={() => setSuggestions([])} />
      </Box>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="flex-start">
        <Card sx={{ width: 260, flexShrink: 0, display: { xs: 'none', md: 'block' } }}>
          <CardContent>
            <CatalogueFilters {...filterProps} />
          </CardContent>
        </Card>
        <Stack spacing={2} sx={{ minWidth: 0, flex: 1 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            flexWrap="wrap"
            gap={1}
          >
            <Typography color="text.secondary">
              {page.total} giochi trovati. Ce n’è pe’ tutti, purtroppo.
            </Typography>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <Select value={sort} onChange={(event) => setSort(event.target.value)}>
                <MenuItem value="rating">Voto più alto</MenuItem>
                <MenuItem value="name">Nome, in ordine</MenuItem>
                <MenuItem value="owners">Più accattati</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          {activeFilters.some(([, values]) => values.length > 0) && (
            <Stack direction="row" flexWrap="wrap" gap={0.75}>
              {activeFilters.flatMap(([type, values, setValues]) =>
                values.map((value) => (
                  <Chip
                    key={`${type}-${value}`}
                    label={`${type}: ${value}`}
                    color="primary"
                    onDelete={() => setValues(toggle(values, value))}
                  />
                ))
              )}
            </Stack>
          )}
          {error && <Alert severity="error">Aò, er catalogo s’è impicciato: {error}</Alert>}
          <Grid container spacing={2} className="equal-height-grid">
            {games.map((game) => (
              <Grid key={game.id} size={{ xs: 12, sm: 6, md: 4, xl: 3 }}>
                <CatalogueGameCard game={game} />
              </Grid>
            ))}
          </Grid>
          {loading && (
            <CircularProgress aria-label="Caricamento catalogo" sx={{ alignSelf: 'center' }} />
          )}
          {!loading && !games.length && (
            <Typography color="text.secondary">
              Niente da fa’: qui nun c’è manco l’ombra d’un gioco.
            </Typography>
          )}
          {hasMore && <div ref={sentinel} aria-label="Carica altri giochi" />}
        </Stack>
      </Stack>
      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Stack spacing={2} sx={{ width: 'min(85vw, 340px)', p: 3 }}>
          <Typography variant="h5">FILTRA ‘STO BORDELLO</Typography>
          <CatalogueFilters {...filterProps} />
          <Button variant="contained" onClick={() => setDrawerOpen(false)}>
            Fatto, annamo
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  )
}
