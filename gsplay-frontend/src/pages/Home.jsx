import { Box, Button, Card, CardContent, CircularProgress, Grid, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { communityApi } from '../services/api';
import { useLoad } from '../hooks/useLoad';
import ProviderIcons from '../components/ProviderIcons';

export default function Home() {
  const { user } = useAuth();
  const topGames = useLoad(communityApi.topGames, []);
  const features = [
    ['Your library', 'Sync Steam or import GOG, Epic, and Amazon exports.'],
    ['Compare', 'Find canonical games owned together.'],
    ['Retro', 'Link RetroAchievements for your profile.']
  ];
  return <Stack spacing={4}><Box><Typography variant="h1">PLAY TOGETHER.<br /><Box component="span" sx={{ color: 'primary.main' }}>FIND THE OVERLAP.</Box></Typography><Typography color="text.secondary" sx={{ maxWidth: 650, mt: 2 }}>A private shared library for comparing collections, discovering catalogue details, and keeping retro progress close.</Typography></Box><Grid container spacing={2}>{features.map(([title, detail]) => <Grid key={title} size={{ xs: 12, md: 4 }}><Card><CardContent><Typography variant="h6">{title}</Typography><Typography color="text.secondary">{detail}</Typography></CardContent></Card></Grid>)}</Grid><Stack spacing={1}><Typography className="pixel-label" variant="h5" color="primary">TOP 20 COMMUNITY GAMES</Typography>{topGames.loading && <CircularProgress />}{topGames.error && <Typography color="error">{topGames.error}</Typography>}{topGames.data?.games?.map((game) => <Card key={game.id}><CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}><Stack direction="row" alignItems="center" spacing={2}><Typography color="primary" sx={{ minWidth: 28 }}>#{game.rank}</Typography><Typography sx={{ flexGrow: 1 }}>{game.title}</Typography><Typography color="text.secondary">Owned by {game.ownerCount}</Typography><Stack direction="row" spacing={.5}>{game.owners.flatMap((owner) => owner.providers).filter((provider, index, all) => all.indexOf(provider) === index).map((provider) => <ProviderIcons key={provider} providers={[provider]} />)}</Stack></Stack></CardContent></Card>)}</Stack>{!user && <Button component={Link} to="/signup" variant="contained" sx={{ alignSelf: 'start' }}>Start your collection</Button>}</Stack>;
}