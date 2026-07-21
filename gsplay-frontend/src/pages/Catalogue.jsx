import { useState } from 'react';
import { Alert, Card, CardContent, Chip, CircularProgress, Grid, Stack, TextField, Typography } from '@mui/material';
import { catalogueApi } from '../services/api';
import { useLoad } from '../hooks/useLoad';

export default function Catalogue() {
  const [query, setQuery] = useState(''); const state = useLoad(() => catalogueApi.games(query), [query]);
  return <Stack spacing={3}><Typography variant="h2">Catalogue</Typography><TextField label="Search canonical games" value={query} onChange={(event) => setQuery(event.target.value)} />{state.error && <Alert severity="error">{state.error}</Alert>}<Grid container spacing={2}>{state.loading ? <CircularProgress /> : state.data?.games?.map((game) => <Grid key={game.id} size={{ xs: 12, sm: 6, lg: 4 }}><Card><CardContent><Typography variant="h6">{game.title}</Typography><Stack direction="row" flexWrap="wrap" gap={.5} sx={{ mt: 1 }}>{game.genres?.map((genre) => <Chip key={genre} size="small" label={genre} />)}</Stack><Typography color="text.secondary" sx={{ mt: 1 }}>{game.summary || 'Metadata is being enriched.'}</Typography></CardContent></Card></Grid>)}</Grid></Stack>;
}