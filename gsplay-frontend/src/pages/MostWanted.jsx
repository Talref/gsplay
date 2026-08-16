import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Box, CircularProgress, Grid, Stack, Typography } from '@mui/material'
import MostWantedCard from '../components/mostWanted/MostWantedCard'
import useInfiniteScroll from '../hooks/useInfiniteScroll'
import { mostWantedApi } from '../services/api'

const PAGE_SIZE = 24

export default function MostWanted() {
  const initialLoadStarted = useRef(false)
  const [games, setGames] = useState([])
  const [page, setPage] = useState({ number: 0, size: PAGE_SIZE, total: 0, hasMore: false })
  const [metadata, setMetadata] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (nextPage, replace = false) => {
    setLoading(true)
    setError('')
    try {
      const response = await mostWantedApi.list(nextPage, PAGE_SIZE)
      setGames((current) => (replace ? response.games : [...current, ...response.games]))
      setPage(response.page)
      setMetadata({
        available: response.available,
        stale: response.stale,
        generatedAt: response.generatedAt,
        coverage: response.coverage
      })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialLoadStarted.current) return
    initialLoadStarted.current = true
    load(1, true)
  }, [load])

  const loadMore = useCallback(() => load(page.number + 1), [load, page.number])
  const sentinel = useInfiniteScroll({ hasMore: page.hasMore, loading, onLoadMore: loadMore })
  const coverage = metadata?.coverage

  return (
    <Stack spacing={3} sx={{ maxWidth: 1100, mx: 'auto' }}>
      <Box>
        <Typography variant="h1" className="pixel-label" color="primary">
          MOST WANTED
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Li giochi più bramati dalla comitiva. Una lista de desideri collettiva, così soffrimo
          tutti insieme davanti ar carrello.
        </Typography>
      </Box>

      {coverage?.eligible > 0 && (
        <Typography variant="body2" color="text.secondary">
          Basato su {coverage.included} wishlist accessibil
          {coverage.included === 1 ? 'e' : 'i'}, su {coverage.eligible}{' '}
          {coverage.eligible === 1 ? 'compare collegato' : 'compari collegati'} a Steam.
          {coverage.unavailable > 0 &&
            (coverage.unavailable === 1
              ? ' L’altra è privata o momentaneamente indisponibile.'
              : ` Le altre ${coverage.unavailable} so’ private o momentaneamente indisponibili.`)}
        </Typography>
      )}
      {metadata?.stale && (
        <Alert severity="warning">
          Steam oggi fa er prezioso: questa è l’ultima classificona buona che c’avemo.
        </Alert>
      )}
      {error && <Alert severity="error">Aò, er manifesto dei desideri s’è impicciato: {error}</Alert>}

      {!loading && metadata && !metadata.available && (
        <Typography color="text.secondary">
          Er manifesto dei desideri ancora nun è arrivato. Ripassa dopo er prossimo giro de Steam.
        </Typography>
      )}
      {!loading && metadata?.available && !games.length && (
        <Typography color="text.secondary">
          Le wishlist ce stanno, ma ner catalogo nun s’è fatto riconosce ancora niente.
        </Typography>
      )}

      <Grid container spacing={2} className="equal-height-grid">
        {games.map((game) => (
          <Grid key={game.id} size={{ xs: 12, md: 6 }}>
            <MostWantedCard game={game} />
          </Grid>
        ))}
      </Grid>
      {loading && <CircularProgress aria-label="Caricamento Most Wanted" sx={{ alignSelf: 'center' }} />}
      {page.hasMore && <div ref={sentinel} aria-label="Carica altri Most Wanted" />}
    </Stack>
  )
}
