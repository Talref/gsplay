import { useState } from 'react';
import { Alert, Button, Card, CardContent, CircularProgress, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { libraryApi } from '../services/api';
import { useLoad } from '../hooks/useLoad';

export default function Compare() {
  const people = useLoad(libraryApi.users, []); const [selected, setSelected] = useState([]); const [result, setResult] = useState(); const [error, setError] = useState('');
  const submit = async () => { try { setResult(await libraryApi.compare(selected)); } catch (err) { setError(err.message); } };
  return <Stack spacing={3}><Typography variant="h2">Compare libraries</Typography><Typography color="text.secondary">Choose other players; your account is always included on the server.</Typography><Card><CardContent><TextField select SelectProps={{ multiple: true }} fullWidth label="Players" value={selected} onChange={(event) => setSelected(event.target.value)}>{people.data?.users?.map((person) => <MenuItem key={person.id} value={person.id}>{person.username}</MenuItem>)}</TextField><Button sx={{ mt: 2 }} variant="contained" onClick={submit} disabled={!selected.length}>Find shared games</Button></CardContent></Card>{people.loading && <CircularProgress />}{error && <Alert severity="error">{error}</Alert>}{result && <><Typography variant="h6">{result.games.length} shared games</Typography><Grid container spacing={2}>{result.games.map((game) => <Grid key={game.id} size={{ xs: 12, sm: 6, md: 4 }}><Card><CardContent><Typography>{game.title}</Typography><Typography color="text.secondary">Owned by {game.ownerIds.length} players</Typography></CardContent></Card></Grid>)}</Grid></>}</Stack>;
}