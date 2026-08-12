import { Alert, Box, Button, Card, CardContent, Chip, Divider, Stack, Typography } from '@mui/material'

const statusColor = {
  open: 'success',
  draft: 'primary',
  published: 'success',
  completed: 'default',
  cancelled: 'error'
}

const cancellationWarning = (status) => {
  if (status === 'open') return 'This will close RSVPs and voting and cancel the upcoming Casual Friday.'
  if (status === 'draft')
    return 'This Casual Friday already has a draft playlist. Cancelling it will prevent the playlist from being published.'
  if (status === 'published')
    return 'This playlist is already visible to members. Cancelling will mark the event and published playlist as cancelled.'
  return 'This event is already marked completed. Cancelling will replace that state for both the event and playlist.'
}

function Names({ label, entries }) {
  return (
    <Typography variant="body2" color="text.secondary">
      <Box component="span" fontWeight={800}>{label} ({entries.length}): </Box>
      {entries.length ? entries.map((entry) => entry.username).join(', ') : 'None'}
    </Typography>
  )
}

export default function EventManagePanel({
  event,
  enabledCandidates,
  onStart,
  onCreateDraft,
  onCancel,
  onComplete
}) {
  if (!event) {
    return (
      <Card component="section" aria-label="Casual Friday process">
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="h6">Weekly process</Typography>
            <Typography color="text.secondary">
              {enabledCandidates.length} rotation games will be locked into the voting pool.
            </Typography>
            {!!enabledCandidates.length && (
              <Typography variant="body2">
                {enabledCandidates.map((item) => item.displayTitle).join(', ')}
              </Typography>
            )}
            <Alert severity="warning">
              Starting Casual Friday will open RSVPs and voting. The current voting list will be
              locked and cannot be changed for this event.
            </Alert>
            <Button
              variant="contained"
              disabled={!enabledCandidates.length}
              onClick={onStart}
              sx={{ alignSelf: 'flex-start' }}
            >
              Start Casual Friday
            </Button>
          </Stack>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card component="section" aria-label="Casual Friday process">
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
            <Typography variant="h6">Weekly process · {event.weekKey}</Typography>
            <Chip color={statusColor[event.status]} label={event.status} />
          </Stack>
          <Typography color="text.secondary">
            Voting closes {new Date(event.votingClosesAt).toLocaleString('en-GB', {
              timeZone: 'Europe/Rome',
              weekday: 'long',
              hour: '2-digit',
              minute: '2-digit'
            })} Europe/Rome. The candidate snapshot contains {event.candidates.length} games.
          </Typography>
          {event.rsvps && (
            <Stack spacing={0.5}>
              <Typography variant="subtitle1" fontWeight={800}>RSVP responses</Typography>
              <Names label="Yes" entries={event.rsvps.names.yes} />
              <Names label="Maybe" entries={event.rsvps.names.maybe} />
              <Names label="No" entries={event.rsvps.names.no} />
            </Stack>
          )}
          {event.votingResults && (
            <Stack spacing={0.75}>
              <Typography variant="subtitle1" fontWeight={800}>Voting results</Typography>
              {event.votingResults.map((candidate) => (
                <Stack key={candidate.rotationGameId} direction="row" justifyContent="space-between" gap={2}>
                  <Typography>{candidate.displayTitle}</Typography>
                  <Typography fontWeight={800}>{candidate.votes}</Typography>
                </Stack>
              ))}
            </Stack>
          )}
          {event.status === 'cancelled' && (
            <Alert severity="error">Cancelled: {event.cancellationReason}</Alert>
          )}
          {event.status !== 'cancelled' && <Divider />}
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
            {event.status === 'open' && (
              <Button variant="contained" disabled={event.open} onClick={onCreateDraft}>
                Create draft playlist
              </Button>
            )}
            {event.status === 'published' && (
              <Button variant="contained" onClick={onComplete}>
                Mark completed
              </Button>
            )}
            {event.status !== 'cancelled' && (
              <Button
                color="error"
                variant="outlined"
                onClick={() => onCancel(cancellationWarning(event.status))}
              >
                Cancel event
              </Button>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}
