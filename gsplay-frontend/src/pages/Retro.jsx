import { Card, CardContent, Stack, Typography } from '@mui/material'

export default function Retro() {
  return (
    <Stack
      spacing={3}
      sx={{ maxWidth: 760, mx: 'auto', pt: { xs: 3, md: 8 }, textAlign: 'center' }}
    >
      <Typography className="pixel-label" color="primary">
        INSERT COIN, MA NON ANCORA
      </Typography>
      <Card>
        <CardContent sx={{ p: { xs: 3, sm: 6 } }}>
          <Stack spacing={2.5} alignItems="center">
            <Typography variant="h1" sx={{ fontSize: 'clamp(2.4rem, 8vw, 5rem)' }}>
              RETROCLUB
            </Typography>
            <Typography variant="h4">Cantiere aperto, joystick chiusi in cassaforte.</Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 570 }}>
              Stamo’ montando cabinati, sfidette e trofei senza far saltà er fusibile. Per ora il
              Retroclub sta a prende’ la rincorsa.
            </Typography>
            <Typography color="primary" className="pixel-label">
              TORNA PRESTO · O FINGI D’AVÉ 3 GETTONI
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}
