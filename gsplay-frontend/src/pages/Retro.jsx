import { useCallback, useEffect, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useAuth } from '../context/useAuth'
import { retroApi } from '../services/api'

function Leaderboard({ entries = [] }) {
  if (!entries.length)
    return <Typography color="text.secondary">Ancora zero punti: er cabinato sta a scaldà.</Typography>
  return (
    <Stack spacing={1}>
      {entries.map((entry) => (
        <Stack
          key={entry.userId}
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          sx={{ p: 1.5, bgcolor: 'rgba(var(--gs-primary-rgb), .06)', borderRadius: 2 }}
        >
          <Typography><strong>#{entry.rank}</strong> {entry.username}</Typography>
          <Typography color="text.secondary">
            {entry.score} punti · {entry.completionPercentage}% · {entry.hardcoreCount} hardcore
          </Typography>
        </Stack>
      ))}
    </Stack>
  )
}

function Winner({ edition }) {
  const winners = edition?.summary?.winners || []
  if (!edition || !winners.length) return null
  return (
    <Card sx={{ overflow: 'visible', background: 'linear-gradient(135deg, #3a2910, #102344 70%)' }}>
      <CardContent sx={{ textAlign: 'center' }}>
        <Box
          aria-hidden="true"
          sx={{ fontSize: 'clamp(4rem, 12vw, 7rem)', lineHeight: 1, filter: 'drop-shadow(0 0 18px #ffd66b)', animation: 'retro-crown 1.8s ease-in-out infinite alternate', '@keyframes retro-crown': { from: { transform: 'rotate(-4deg) scale(.96)' }, to: { transform: 'rotate(4deg) scale(1.06)' } } }}
        >
          👑
        </Box>
        <Typography className="pixel-label" color="warning.main">RE DEL MESE SCORSO</Typography>
        <Typography variant="h4" sx={{ mt: 1 }}>{winners.map((winner) => winner.username).join(' & ')}</Typography>
        <Typography color="text.secondary">su {edition.title} · {winners[0].score} punti</Typography>
      </CardContent>
    </Card>
  )
}

export default function Retro() {
  const { user, refresh: refreshUser } = useAuth()
  const [club, setClub] = useState(null)
  const [editions, setEditions] = useState([])
  const [archive, setArchive] = useState({ page: 0, hasMore: true, loaded: false })
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadClub = useCallback(async () => {
    setLoading(true)
    try {
      setClub(await retroApi.club())
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { loadClub() }, [loadClub])

  const link = async () => {
    setSaving(true)
    setError('')
    try {
      await retroApi.link(username)
      await refreshUser()
      setUsername('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  const unlink = async () => {
    if (!window.confirm('Scollegare il profilo RetroAchievements da GSPlay?')) return
    setSaving(true)
    setError('')
    try {
      await retroApi.unlink()
      await refreshUser()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  const loadArchive = async () => {
    if (!archive.hasMore) return
    try {
      const response = await retroApi.editions(archive.page + 1)
      setEditions((current) => [...current, ...response.editions])
      setArchive({ page: response.page, hasMore: response.hasMore, loaded: true })
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const active = club?.active
  return (
    <Stack spacing={3} sx={{ maxWidth: 1050, mx: 'auto' }}>
      <Box>
        <Typography variant="h1" color="primary">RETROCLUB</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Un gioco ar mese, trofei a secchiate e gloria eterna finché nun staccamo la spina.
        </Typography>
      </Box>
      {error && <Alert severity="error">Er cabinato s’è incantato: {error}</Alert>}
      <Winner edition={club?.lastMonth} />

      {!user?.retroAchievements && (
        <Card><CardContent>
          <Typography variant="h5">Attacca er profilo RetroAchievements</Typography>
          <Typography color="text.secondary" sx={{ my: 1 }}>Ce serve pe contà i trofei del mese senza fa’ i conti sul tovagliolo.</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField label="Username RetroAchievements" value={username} onChange={(event) => setUsername(event.target.value)} />
            <Button variant="contained" disabled={saving || !username.trim()} onClick={link}>Collega</Button>
          </Stack>
        </CardContent></Card>
      )}
      {user?.retroAchievements && (
        <Alert
          severity="success"
          action={<Button color="inherit" size="small" disabled={saving} onClick={unlink}>Scollega</Button>}
        >
          Profilo collegato: {user.retroAchievements.username}
        </Alert>
      )}

      {loading && <CircularProgress sx={{ alignSelf: 'center' }} />}
      {!loading && !active && <Card><CardContent><Typography variant="h5">Er gioco der mese ancora nun è partito.</Typography><Typography color="text.secondary">L’admin starà a soffià sulle cartucce. Porta pazienza.</Typography></CardContent></Card>}
      {active && (
        <>
          <Card>
            <Grid container>
              {active.imageUrl && <Grid size={{ xs: 12, md: 4 }}><Box component="img" src={active.imageUrl} alt="" sx={{ width: '100%', height: '100%', minHeight: 260, objectFit: 'cover' }} /></Grid>}
              <Grid size={{ xs: 12, md: active.imageUrl ? 8 : 12 }}><CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
                <Typography className="pixel-label" color="primary">GIOCO DEL MESE</Typography>
                <Typography variant="h2" sx={{ mt: 1 }}>{active.title}</Typography>
                <Typography color="text.secondary">{active.consoleName}</Typography>
                {active.description && <Typography sx={{ mt: 2, whiteSpace: 'pre-wrap' }}>{active.description}</Typography>}
              </CardContent></Grid>
            </Grid>
          </Card>
          <Box>
            <Typography variant="h4" sx={{ mb: 2 }}>Trofei sbloccati dalla comitiva</Typography>
            <Grid container spacing={2}>
              {active.achievements.map((achievement) => (
                <Grid key={achievement.achievementId} size={{ xs: 12, sm: 6, lg: 4 }}>
                  <Card sx={{ height: '100%' }}><CardContent>
                    <Stack direction="row" spacing={1.5}>
                      <Avatar src={achievement.badgeUrl} variant="rounded" sx={{ width: 56, height: 56 }} />
                      <Box><Typography fontWeight={800}>{achievement.title}</Typography><Typography variant="body2" color="text.secondary">{achievement.points} punti · {achievement.playerCount} compari</Typography></Box>
                    </Stack>
                    <Typography variant="body2" sx={{ mt: 1 }}>{achievement.description}</Typography>
                  </CardContent></Card>
                </Grid>
              ))}
            </Grid>
          </Box>
          <Card><CardContent><Typography variant="h4" sx={{ mb: 2 }}>Classifica</Typography><Leaderboard entries={active.leaderboard} /></CardContent></Card>
        </>
      )}

      <Accordion onChange={(_, expanded) => expanded && !archive.loaded && loadArchive()}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography variant="h5">Edizioni passate</Typography></AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            {archive.loaded && !editions.length && <Typography color="text.secondary">Nessun mese da riesumà, ancora.</Typography>}
            {editions.map((edition) => (
              <Box key={edition.id} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
                <Typography fontWeight={800}>{edition.monthKey} · {edition.title}</Typography>
                <Typography color="text.secondary">
                  Vincitore: {edition.summary.winners.map((winner) => winner.username).join(' & ') || 'nessuno'} · {edition.summary.participants} giocatori · {edition.summary.totalUnlocks} trofei · media {edition.summary.averageCompletion}%
                </Typography>
              </Box>
            ))}
            {archive.hasMore && <Button onClick={loadArchive}>Carica altre edizioni</Button>}
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Stack>
  )
}
