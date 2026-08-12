import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Stack,
  Typography
} from '@mui/material'
import { casualFridayApi } from '../../services/api'

const rsvpOptions = [
  ['yes', 'Ce sto'],
  ['maybe', 'Forse, se me gira'],
  ['no', 'Nun ce sto']
]

export default function MemberEventPanel({ initialEvent }) {
  const [event, setEvent] = useState(initialEvent)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => setEvent(initialEvent), [initialEvent])
  if (!event || !['open', 'draft'].includes(event.status)) return null

  const saveRsvp = async (rsvp) => {
    setSaving(true)
    setError('')
    try {
      setEvent((await casualFridayApi.setRsvp(event.id, rsvp)).event)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }
  const toggleVote = async (rotationGameId) => {
    const selected = event.response.voteRotationGameIds
    const next = selected.includes(rotationGameId)
      ? selected.filter((id) => id !== rotationGameId)
      : [...selected, rotationGameId]
    if (next.length > event.maxVotes) {
      setError(`Massimo ${event.maxVotes} giochi, Cesare. Toccane uno già scelto pe’ liberà er posto.`)
      return
    }
    setSaving(true)
    setError('')
    try {
      setEvent((await casualFridayApi.setVotes(event.id, next)).event)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card component="section" aria-label="Conferma presenza e vota">
      <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}>
        <Stack spacing={2.5}>
          <Stack spacing={0.5}>
            <Typography variant="h4">Dì la tua ar Senato</Typography>
            <Typography color="text.secondary">
              Conferma se vieni e scegli fino a {event.maxVotes} giochi. Le urne chiudono venerdì
              alle 15:00, ora de Roma — che è pure l’unica ora che conta.
            </Typography>
          </Stack>
          {!event.open && (
            <Alert severity="info">Le urne so’ chiuse. Mo’ li magistrati preparano la scaletta.</Alert>
          )}
          {error && <Alert severity="error">Aò: {error}</Alert>}
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
            {rsvpOptions.map(([value, label]) => (
              <Button
                key={value}
                variant={event.response.rsvp === value ? 'contained' : 'outlined'}
                disabled={saving || !event.open}
                onClick={() => saveRsvp(value)}
              >
                {label}
              </Button>
            ))}
          </Stack>
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Li giochi candidati</Typography>
              <Chip
                color={event.response.voteRotationGameIds.length === event.maxVotes ? 'primary' : 'default'}
                label={`${event.response.voteRotationGameIds.length}/${event.maxVotes} scelti`}
              />
            </Stack>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                gap: 1
              }}
            >
              {event.candidates.map((candidate) => {
                const selected = event.response.voteRotationGameIds.includes(candidate.rotationGameId)
                return (
                  <Card
                    key={candidate.rotationGameId}
                    variant="outlined"
                    sx={{ borderColor: selected ? 'primary.main' : 'divider' }}
                  >
                    <CardActionArea
                      disabled={saving || !event.open}
                      onClick={() => toggleVote(candidate.rotationGameId)}
                      sx={{ p: 1.25, display: 'flex', justifyContent: 'flex-start', gap: 1.5 }}
                    >
                      <Box
                        component="img"
                        src={candidate.artwork || '/placeholder-game.jpg'}
                        alt=""
                        sx={{ width: 54, height: 72, objectFit: 'cover', borderRadius: 1 }}
                      />
                      <Stack sx={{ minWidth: 0 }}>
                        <Typography fontWeight={800}>{candidate.displayTitle}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {candidate.playerCountLabel || `${candidate.playerCountMin}–${candidate.playerCountMax} giocatori`}
                        </Typography>
                        <Typography variant="caption" color={selected ? 'primary' : 'text.secondary'}>
                          {selected ? 'Voto depositato nell’urna' : 'Tocca pe’ votà'}
                        </Typography>
                      </Stack>
                    </CardActionArea>
                  </Card>
                )
              })}
            </Box>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}
