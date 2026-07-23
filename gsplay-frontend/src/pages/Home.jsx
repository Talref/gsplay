import { useState } from 'react';
import { Box, Button, Card, CardContent, CircularProgress, Grid, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { communityApi } from '../services/api';
import { useLoad } from '../hooks/useLoad';
import ProviderIcons from '../components/ProviderIcons';
import ThemedDialog from '../components/ThemedDialog';

export default function Home() {
  const { user } = useAuth();
  const topGames = useLoad(communityApi.topGames, []);
  const [selectedGame, setSelectedGame] = useState(null);
  const features = [
    ['La tua libbreria', 'Aggancia Steam o importa GOG, Epic e Amazon. Poi fai finta de giocarli.'],
    ['Confronta', 'Scova i giochi che c’avete tutti. Sì, proprio tutti.'],
    ['Retro', 'Collega RetroAchievements e sfodera er curriculum da salagiochi. (lavori in corso)']
  ];
  const ownerCount = selectedGame?.ownerCount === 1 ? 'un disgraziato' : `${selectedGame?.ownerCount || 0} disgraziati`;
  return <Stack spacing={4}><Box><Typography variant="h1" sx={{ color: '#edfdf8' }}>GIOCATE INSIEME,<br />CHE DA SOLI VE STUFATE.<br /><Box component="span" sx={{ color: 'primary.main' }}>TROVATE ER GIOCO CHE C’AVETE TUTTI.</Box></Typography><Typography color="text.secondary" sx={{ width: '100%', maxWidth: 'none', mt: 2 }}>La ludoteca privata pe’ scoprì chi c’ha cosa. E pe’ giudicà poco amichevolmente chi c’ha troppi giochi e zero ore giocate.</Typography></Box><Grid container spacing={2} className="equal-height-grid">{features.map(([title, detail]) => <Grid key={title} size={{ xs: 12, md: 4 }}><Card><CardContent><Typography variant="h6">{title}</Typography><Typography color="text.secondary">{detail}</Typography></CardContent></Card></Grid>)}</Grid><Stack spacing={1}><Typography className="pixel-label" variant="h5" color="primary">I 20 GIOCHI PIÙ ACCATTATI DALLA COMUNITÀ</Typography>{topGames.loading && <CircularProgress aria-label="Caricamento classificona" />}{topGames.error && <Typography color="error">Aò, la classificona s’è impicciata: riprova tra poco.</Typography>}{topGames.data?.games?.map((game) => <Card key={game.id} className="game-card game-card--interactive" role="button" tabIndex={0} aria-label={`Apri i proprietari di ${game.title}`} onClick={() => setSelectedGame(game)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedGame(game); } }}><CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}><Stack direction="row" alignItems="center" spacing={2}><Typography color="primary" sx={{ minWidth: 28 }}>#{game.rank}</Typography><Typography className="game-title-clamp" sx={{ flexGrow: 1, minHeight: 0 }}>{game.title}</Typography><Typography color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>{game.ownerCount} {game.ownerCount === 1 ? 'proprietario' : 'proprietari'}</Typography><Stack direction="row" spacing={.5}>{game.owners.flatMap((owner) => owner.providers).filter((provider, index, all) => all.indexOf(provider) === index).map((provider) => <ProviderIcons key={provider} providers={[provider]} />)}</Stack></Stack></CardContent></Card>)}</Stack>{!user && <Button component={Link} to="/signup" variant="contained" sx={{ alignSelf: 'start' }}>Fatti una libbreria, daje</Button>}<ThemedDialog open={Boolean(selectedGame)} onClose={() => setSelectedGame(null)} title={selectedGame?.title || ''}><Typography color="text.secondary" sx={{ mb: 1 }}>Ce l’hanno {ownerCount}:</Typography><List disablePadding>{selectedGame?.owners?.map((owner) => <ListItem key={owner.username} disableGutters secondaryAction={<Stack direction="row" spacing={.75}><ProviderIcons providers={owner.providers} /></Stack>}><ListItemText primary={owner.username} /></ListItem>)}</List></ThemedDialog></Stack>;
}