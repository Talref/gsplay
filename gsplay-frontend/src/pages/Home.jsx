import { Box, Button, Card, CardContent, Grid, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function Home() {
  const { user } = useAuth();
  const features = [
    ['Your library', 'Sync Steam or import GOG, Epic, and Amazon exports.'],
    ['Compare', 'Find canonical games owned together.'],
    ['Retro', 'Link RetroAchievements for your profile.']
  ];
  return <Stack spacing={4}><Box><Typography variant="h1">PLAY TOGETHER.<br /><Box component="span" sx={{ color: 'primary.main' }}>FIND THE OVERLAP.</Box></Typography><Typography color="text.secondary" sx={{ maxWidth: 650, mt: 2 }}>A private shared library for comparing collections, discovering catalogue details, and keeping retro progress close.</Typography></Box><Grid container spacing={2}>{features.map(([title, detail]) => <Grid key={title} size={{ xs: 12, md: 4 }}><Card><CardContent><Typography variant="h6">{title}</Typography><Typography color="text.secondary">{detail}</Typography></CardContent></Card></Grid>)}</Grid>{!user && <Button component={Link} to="/signup" variant="contained" sx={{ alignSelf: 'start' }}>Start your collection</Button>}</Stack>;
}