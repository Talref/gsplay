import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { useAuth } from '../context/useAuth'
import { retroApi } from '../services/api'

function AchievementStrip({ achievements = [] }) {
  const strip = useRef(null)
  const [selected, setSelected] = useState(null)
  const ordered = [...achievements].sort(
    (first, second) => second.playerCount - first.playerCount || first.displayOrder - second.displayOrder
  )
  const scroll = (direction) => strip.current?.scrollBy({ left: direction * 360, behavior: 'smooth' })

  if (!ordered.length)
    return <Typography color="text.secondary">Er tabellone dei trofei ancora nun s’è acceso.</Typography>
  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <IconButton aria-label="Scorri i trofei indietro" onClick={() => scroll(-1)} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
          <ChevronLeftIcon />
        </IconButton>
        <Box
          ref={strip}
          sx={{
            display: 'flex',
            gap: 1.25,
            overflowX: 'auto',
            scrollSnapType: 'x proximity',
            scrollbarColor: 'var(--gs-primary) var(--gs-surface-deep)',
            pb: 1.25,
            px: 0.5,
            flex: 1
          }}
        >
          {ordered.map((achievement) => (
            <Tooltip
              key={achievement.achievementId}
              arrow
              title={
                <Stack spacing={0.5} sx={{ p: 0.5, maxWidth: 280 }}>
                  <Typography fontWeight={800}>{achievement.title}</Typography>
                  <Typography variant="body2">{achievement.description}</Typography>
                  <Typography variant="caption">{achievement.points} punti · {achievement.playerCount} compari</Typography>
                </Stack>
              }
            >
              <Box
                component="button"
                type="button"
                aria-label={`Mostra dettagli trofeo: ${achievement.title}`}
                onClick={() => setSelected((current) => current?.achievementId === achievement.achievementId ? null : achievement)}
                sx={{
                  position: 'relative',
                  flex: '0 0 72px',
                  width: 72,
                  height: 72,
                  p: 0,
                  border: 2,
                  borderColor: achievement.playerCount ? 'primary.main' : 'divider',
                  borderRadius: 1.5,
                  overflow: 'hidden',
                  bgcolor: 'transparent',
                  cursor: 'pointer',
                  scrollSnapAlign: 'start',
                  filter: achievement.playerCount ? 'none' : 'grayscale(1) opacity(.42)',
                  transition: 'transform .18s ease, filter .18s ease',
                  '&:hover, &:focus-visible': { transform: 'translateY(-3px) scale(1.04)', filter: achievement.playerCount ? 'brightness(1.12)' : 'grayscale(1) opacity(.62)' }
                }}
              >
                <Box component="img" src={achievement.badgeUrl} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <Box className="pixel-label" sx={{ position: 'absolute', right: 0, bottom: 0, px: 0.6, py: 0.25, fontSize: '.58rem', bgcolor: 'primary.main', color: 'primary.contrastText' }}>
                  {achievement.playerCount}
                </Box>
              </Box>
            </Tooltip>
          ))}
        </Box>
        <IconButton aria-label="Scorri i trofei avanti" onClick={() => scroll(1)} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
          <ChevronRightIcon />
        </IconButton>
      </Stack>
      {selected && (
        <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
          <Typography fontWeight={800}>{selected.title}</Typography>
          <Typography color="text.secondary" variant="body2">{selected.description}</Typography>
          <Typography className="pixel-label" color="primary" sx={{ mt: 1, fontSize: '.72rem' }}>
            {selected.points} PUNTI · {selected.playerCount} COMPARI
          </Typography>
        </Box>
      )}
    </Stack>
  )
}

function ProgressRankings({ edition }) {
  const entries = edition?.leaderboard || []
  if (!entries.length)
    return <Typography color="text.secondary">Ancora zero punti: er cabinato sta a scaldà.</Typography>
  const achievementMap = new Map(edition.achievements.map((item) => [item.achievementId, item]))
  const completion = [...entries].sort(
    (first, second) => second.completionPercentage - first.completionPercentage || second.score - first.score
  )
  return (
    <Stack spacing={4}>
      <Box>
        <Typography className="pixel-label" color="primary" sx={{ mb: 1 }}>COMPLETAMENTO MEDIO</Typography>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <LinearProgress variant="determinate" value={edition.summary.averageCompletion} sx={{ flex: 1, height: 12, borderRadius: 8, '& .MuiLinearProgress-bar': { borderRadius: 8 } }} />
          <Typography className="pixel-label" sx={{ minWidth: 64, textAlign: 'right' }}>{edition.summary.averageCompletion}%</Typography>
        </Stack>
      </Box>
      <Box>
        <Typography variant="h5" sx={{ mb: 2 }}>Rank completamento</Typography>
        <Stack spacing={2}>
          {completion.map((entry, index) => (
            <Box key={entry.userId}>
              <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 0.75 }}>
                <Typography className="pixel-label" sx={{ fontSize: '.75rem' }}>#{index + 1} {entry.username}</Typography>
                <Typography className="pixel-label" color="primary" sx={{ fontSize: '.75rem' }}>{entry.completionPercentage}%</Typography>
              </Stack>
              <LinearProgress variant="determinate" value={entry.completionPercentage} sx={{ height: 8, borderRadius: 5, '& .MuiLinearProgress-bar': { borderRadius: 5 } }} />
            </Box>
          ))}
        </Stack>
      </Box>
      <Box>
        <Typography variant="h5" sx={{ mb: 2 }}>Rank punteggio</Typography>
        <Stack spacing={2.5}>
          {entries.map((entry) => (
            <Box key={entry.userId} sx={{ p: 1.5, bgcolor: 'rgba(var(--gs-primary-rgb), .05)', borderRadius: 2 }}>
              <Stack direction="row" justifyContent="space-between" spacing={1}>
                <Typography className="pixel-label" sx={{ fontSize: '.75rem' }}>#{entry.rank} {entry.username}</Typography>
                <Typography className="pixel-label" color="primary" sx={{ fontSize: '.75rem' }}>{entry.score} PTS</Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} sx={{ mt: 1.5, overflowX: 'auto', pb: 0.75 }}>
                {entry.achievementIds.map((achievementId) => {
                  const achievement = achievementMap.get(achievementId)
                  return achievement ? <Tooltip key={achievementId} title={`${achievement.title} · ${achievement.points} punti`}><Box component="img" src={achievement.badgeUrl} alt="" sx={{ width: 42, height: 42, flex: '0 0 auto', borderRadius: 1, border: 1, borderColor: 'primary.main' }} /></Tooltip> : null
                })}
              </Stack>
            </Box>
          ))}
        </Stack>
      </Box>
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
  const [linkedNotice, setLinkedNotice] = useState(false)

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
      setLinkedNotice(true)
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
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="h1" color="primary">RETROCLUB</Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Un gioco ar mese, trofei a secchiate e gloria eterna finché nun staccamo la spina.
            </Typography>
          </Box>
          {user?.retroAchievements && (
            <Button size="small" color="inherit" disabled={saving} onClick={unlink} sx={{ color: 'text.secondary', opacity: 0.72, whiteSpace: 'nowrap', fontSize: { xs: '.65rem', sm: '.75rem' }, px: { xs: 0.5, sm: 1 } }}>
              Scollega il tuo account
            </Button>
          )}
        </Stack>
      </Box>
      {error && <Alert severity="error">Er cabinato s’è incantato: {error}</Alert>}
      {linkedNotice && <Alert severity="success" onClose={() => setLinkedNotice(false)}>Profilo RetroAchievements collegato. Mo’ i trofei contano davvero.</Alert>}
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
            <Typography variant="h4">Bacheca dei trofei</Typography>
            <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
              Passace sopra cor mouse, oppure toccane uno: gli spoiler escono solo se li chiami.
            </Typography>
            <AchievementStrip achievements={active.achievements} />
          </Box>
          <Card><CardContent><Typography variant="h4" sx={{ mb: 3 }}>Classifiche</Typography><ProgressRankings edition={active} /></CardContent></Card>
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
