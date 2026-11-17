import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography
} from '@mui/material'
import { awardsApi } from '../services/api'
import AwardsGameSearch from '../components/awards/AwardsGameSearch'
import GamePreview from '../components/awards/GamePreview'

const labels = {
  draft: 'In preparazione',
  nominations: 'Nomination aperte',
  review: 'Revisione',
  voting: 'Votazioni aperte',
  closed: 'Votazioni chiuse',
  published: 'Risultati pubblicati'
}
const waiting = {
  draft: 'Stamo a preparà le categorie. Lucida la corona e ripassa.',
  review: 'Le nomination so’ arrivate. Mo’ tocca all’admin preparà la scheda.',
  closed: 'Urne chiuse, fiato sospeso. I vincitori arrivano appena l’admin dà er via.'
}
const formatDate = (value) =>
  new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Rome'
  }).format(new Date(value))

export default function Awards() {
  const [data, setData] = useState(null)
  const [selected, setSelected] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const load = useCallback(async () => {
    try {
      setData(await awardsApi.current())
      setError('')
    } catch {
      setError('Aò, i Game Awards nun se caricano. Riprova fra poco.')
    }
  }, [])
  useEffect(() => {
    load()
    const timer = setInterval(load, 30000)
    return () => clearInterval(timer)
  }, [load])
  const edition = data?.edition
  const nomination = edition?.status === 'nominations'
  const submitted = nomination ? edition?.nominated : edition?.voted
  const active = ['nominations', 'voting'].includes(edition?.status)
  const selectionKey = `${edition?.id}:${edition?.status}`
  // Keying the form by phase prevents stale nominations from becoming ballot choices.
  const choices = selected.key === selectionKey ? selected.values : {}
  const choose = (categoryId, games) =>
    setSelected({ key: selectionKey, values: { ...choices, [categoryId]: games } })
  const selections = Object.entries(choices)
    .filter(([, games]) => games.length)
    .map(([categoryId, games]) => ({ categoryId, igdbIds: games.map((game) => game.igdbId) }))
  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      setData(
        await awardsApi.submit(nomination ? 'nominations' : 'ballots', edition.id, selections)
      )
      setSelected({})
    } catch (requestError) {
      await load()
      setError(
        requestError.status === 409
          ? 'Aò, la fase è cambiata o hai già inviato. Controlla lo stato qui sotto.'
          : 'L’invio nun è riuscito. Riprova: le tue scelte stanno ancora qui.'
      )
    } finally {
      setBusy(false)
      setConfirm(false)
    }
  }
  return (
    <Stack spacing={3} sx={{ maxWidth: 1000, mx: 'auto' }}>
      <Typography variant="h2" className="pixel-label">
        GAME AWARDS{edition ? ` ${edition.year}` : ''}
      </Typography>
      <Typography color="text.secondary">
        La gloria dura un anno. Le discussioni in chat, de più.
      </Typography>
      {error && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" onClick={load}>
              Riprova
            </Button>
          }
        >
          {error}
        </Alert>
      )}
      {!data && !error && <CircularProgress />}
      {data && !edition && (
        <Alert severity="info">
          Pe’ mo’ la corona sta ner cassetto. Ripassa quando partono i Game Awards.
        </Alert>
      )}
      {edition && (
        <>
          <Chip
            label={labels[edition.status]}
            color={active ? 'success' : 'default'}
            sx={{ alignSelf: 'flex-start' }}
          />
          {active && (
            <Typography>
              Chiusura:{' '}
              {formatDate(nomination ? edition.nominationsCloseAt : edition.votingClosesAt)} · ora
              de Roma.
            </Typography>
          )}
          {waiting[edition.status] && <Alert severity="info">{waiting[edition.status]}</Alert>}
          {active && submitted && (
            <Alert severity="success">
              {nomination
                ? 'Hai già nominato, aò! Le tue scelte stanno in cassaforte.'
                : 'Hai già votato, aò! Er dado è tratto, mo’ aspetta la gloria.'}
            </Alert>
          )}
          {active && !submitted && (
            <>
              <Typography>
                {nomination
                  ? 'Scegli fino a quattro giochi per categoria. Se una nun te dice niente, saltala.'
                  : 'Un voto per categoria. Quelle che nun te convincono le puoi saltà.'}{' '}
                Quando invii, le scelte so’ definitive.
              </Typography>
              {edition.categories.map((category) => (
                <Card key={category.id}>
                  <CardContent>
                    <Stack spacing={2}>
                      <Typography variant="h5" id={`category-${category.id}`}>
                        {category.name}
                      </Typography>
                      {category.description && (
                        <Typography color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                          {category.description}
                        </Typography>
                      )}
                      {nomination ? (
                        <AwardsGameSearch
                          category={category}
                          selected={choices[category.id] || []}
                          onChange={(games) => choose(category.id, games)}
                          disabled={busy}
                        />
                      ) : (
                        <FormControl disabled={busy}>
                          <RadioGroup
                            aria-labelledby={`category-${category.id}`}
                            value={choices[category.id]?.[0]?.igdbId || ''}
                            onChange={(event) =>
                              choose(
                                category.id,
                                event.target.value
                                  ? [
                                      category.finalists.find(
                                        (game) => game.igdbId === Number(event.target.value)
                                      )
                                    ]
                                  : []
                              )
                            }
                          >
                            <FormControlLabel
                              value=""
                              control={<Radio />}
                              label="Salta questa categoria"
                            />
                            {category.finalists.map((game) => (
                              <Stack key={game.igdbId} spacing={1} sx={{ py: 1 }}>
                                <FormControlLabel
                                  value={game.igdbId}
                                  control={<Radio />}
                                  label={game.title}
                                />
                                <GamePreview game={game} />
                              </Stack>
                            ))}
                          </RadioGroup>
                        </FormControl>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              ))}
              <Button
                variant="contained"
                size="large"
                disabled={busy || !selections.length}
                onClick={() => setConfirm(true)}
              >
                {nomination ? 'Invia nomination' : 'Invia voti'}
              </Button>
            </>
          )}
          {edition.status === 'published' && (
            <>
              <Typography variant="h4">E la corona va a…</Typography>
              {edition.categories.map((category) => (
                <Card key={category.id}>
                  <CardContent>
                    <Stack spacing={2}>
                      <Typography variant="h5">{category.name}</Typography>
                      {category.description && (
                        <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                          {category.description}
                        </Typography>
                      )}
                      <GamePreview game={category.winner} />
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </>
      )}
      <Dialog
        open={confirm && active && !submitted}
        onClose={() => !busy && setConfirm(false)}
        aria-labelledby="awards-confirm-title"
        fullWidth
      >
        <DialogTitle id="awards-confirm-title">Confermi le tue scelte?</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography>
              L’invio è definitivo. Non potrai modificare le scelte o inviare di nuovo.
            </Typography>
            {edition?.categories
              .filter((category) => choices[category.id]?.length)
              .map((category) => (
                <div key={category.id}>
                  <Typography fontWeight={700}>{category.name}</Typography>
                  <Typography>
                    {choices[category.id].map((game) => game.title).join(', ')}
                  </Typography>
                </div>
              ))}
            <Typography>
              {(edition?.categories.length || 0) - selections.length} categorie saltate.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setConfirm(false)}>
            Torna alle scelte
          </Button>
          <Button disabled={busy} variant="contained" onClick={submit}>
            Conferma invio definitivo
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
