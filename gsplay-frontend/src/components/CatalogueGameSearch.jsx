import { useEffect, useState } from 'react';
import { Autocomplete, CircularProgress, TextField } from '@mui/material';
import { catalogueApi } from '../services/api';

/**
 * Server-backed canonical-game preview. It intentionally waits for three
 * characters so catalogue administration does not repeatedly load broad pages.
 * MUI Autocomplete supplies Arrow-key navigation and Enter selection.
 */
export default function CatalogueGameSearch({ label = 'Search catalogue', onSelect, excludeId, loadGames = catalogueApi.games }) {
  const [input, setInput] = useState(''); const [options, setOptions] = useState([]); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  useEffect(() => {
    const query = input.trim();
    if (query.length < 3) { setOptions([]); setLoading(false); setError(''); return undefined; }
    let active = true; setLoading(true); setError('');
    const timer = setTimeout(() => loadGames(query, 1, 12)
      .then((response) => active && setOptions(response.games.filter((game) => game.id !== excludeId)))
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false)), 220);
    return () => { active = false; clearTimeout(timer); };
  }, [excludeId, input, loadGames]);
  return <Autocomplete
    options={options}
    loading={loading}
    filterOptions={(rows) => rows}
    getOptionLabel={(game) => game.title}
    noOptionsText={input.trim().length < 3 ? 'Type at least 3 characters to preview matches.' : error || 'No canonical games found.'}
    onChange={(_, game) => { if (game) onSelect(game); }}
    onInputChange={(_, value, reason) => { if (reason !== 'reset') setInput(value); }}
    renderOption={(props, game) => <li {...props} key={game.id}>{game.title}{game.alternativeTitles?.length ? ` · ${game.alternativeTitles.slice(0, 2).join(', ')}` : ''}</li>}
    renderInput={(params) => <TextField {...params} label={label} helperText="Type 3+ characters. Use ↑/↓ and Enter to choose a server result." InputProps={{ ...params.InputProps, endAdornment: <>{loading ? <CircularProgress color="inherit" size={18} /> : null}{params.InputProps.endAdornment}</> }} />}
  />;
}