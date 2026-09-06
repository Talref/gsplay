import { useEffect, useState } from 'react'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import { casualFridayApi } from '../../services/api'

export default function MovieSearchDialog({ open, saving, onClose, onSelect }) {
  const [query, setQuery] = useState('')
  const [movies, setMovies] = useState([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) {
      setQuery('')
      setMovies([])
      setError('')
    }
  }, [open])

  const search = async (event) => {
    event.preventDefault()
    if (query.trim().length < 2) return
    setSearching(true)
    setError('')
    try {
      const result = await casualFridayApi.searchMovies(query.trim())
      setMovies(result.movies)
    } catch (err) {
      setMovies([])
      setError(err.message)
    } finally {
      setSearching(false)
    }
  }

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="md">
      <DialogTitle>Add movie</DialogTitle>
      <DialogContent>
        <Stack component="form" onSubmit={search} spacing={2} sx={{ pt: 1 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
            <TextField
              autoFocus
              fullWidth
              label="Movie title"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              slotProps={{ htmlInput: { minLength: 2, maxLength: 100 } }}
            />
            <Button
              type="submit"
              variant="contained"
              startIcon={<SearchRoundedIcon />}
              disabled={searching || saving || query.trim().length < 2}
            >
              Search TMDB
            </Button>
          </Stack>
          {error && <Alert severity="error">{error}</Alert>}
          {!searching && movies.length === 0 && query.trim().length >= 2 && !error && (
            <Typography color="text.secondary">No TMDB results yet.</Typography>
          )}
          <Stack spacing={1}>
            {movies.map((movie) => (
              <Button
                key={movie.tmdbId}
                variant="outlined"
                color="inherit"
                disabled={saving}
                onClick={() => onSelect(movie)}
                sx={{ justifyContent: 'flex-start', p: 1.25, textAlign: 'left' }}
              >
                <Stack direction="row" gap={1.5} alignItems="flex-start" sx={{ width: '100%' }}>
                  <Box
                    component="img"
                    src={movie.posterUrl || '/placeholder-game.jpg'}
                    alt=""
                    sx={{ width: 54, aspectRatio: '2 / 3', objectFit: 'cover', borderRadius: 1 }}
                  />
                  <Stack sx={{ minWidth: 0 }}>
                    <Typography fontWeight={800}>
                      {movie.title}
                      {movie.year ? ` (${movie.year})` : ''}
                    </Typography>
                    {movie.originalTitle && movie.originalTitle !== movie.title && (
                      <Typography variant="caption" color="text.secondary">
                        {movie.originalTitle}
                      </Typography>
                    )}
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        display: '-webkit-box',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: 2,
                        overflow: 'hidden'
                      }}
                    >
                      {movie.overview || 'No description available.'}
                    </Typography>
                  </Stack>
                </Stack>
              </Button>
            ))}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={saving} onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}
