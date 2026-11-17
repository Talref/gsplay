import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useAuth } from '../context/useAuth'
import { awardsApi } from '../services/api'

const blank = () => ({ name: '', description: '', links: '' })
function CategoryEditor({ edition, busy, save, onDirty }) {
  const review = edition.status === 'review'
  const source = review ? edition.votingCategories : edition.nominationCategories
  const [rows, setRows] = useState(
    source.length
      ? source.map((category) => ({
          name: category.name,
          description: category.description,
          links: (category.finalists || []).map((game) => game.igdbUrl).join('\n')
        }))
      : [blank()]
  )
  const change = (index, field, value) => {
    onDirty()
    setRows(rows.map((row, position) => (position === index ? { ...row, [field]: value } : row)))
  }
  const persist = () =>
    save(
      rows.map((row) => ({
        name: row.name,
        description: row.description,
        ...(review
          ? {
              igdbUrls: row.links
                .split('\n')
                .map((url) => url.trim())
                .filter(Boolean)
            }
          : {})
      }))
    )
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h5">
            {review ? 'Build voting categories' : 'Prepare nomination categories'}
          </Typography>
          <Typography color="text.secondary">
            {review
              ? 'Build the ballot independently of nominations. Resolve eligibility and duplicates manually, and paste one canonical IGDB finalist URL per line. Empty categories can be saved during preparation; each category needs a finalist before voting starts.'
              : 'Set the categories used to collect nominations. They are fixed when nominations start.'}
          </Typography>
          {rows.map((row, index) => (
            <Stack
              key={index}
              spacing={2}
              sx={{ border: 1, borderColor: 'divider', p: 2, borderRadius: 1 }}
            >
              <TextField
                label={`Category ${index + 1} name`}
                value={row.name}
                onChange={(event) => change(index, 'name', event.target.value)}
                disabled={busy}
                inputProps={{ maxLength: 160 }}
              />
              <TextField
                label={`Category ${index + 1} description`}
                multiline
                minRows={2}
                value={row.description}
                onChange={(event) => change(index, 'description', event.target.value)}
                disabled={busy}
                inputProps={{ maxLength: 2000 }}
              />
              {review && (
                <TextField
                  label={`Category ${index + 1} finalist IGDB URLs`}
                  multiline
                  minRows={3}
                  value={row.links}
                  onChange={(event) => change(index, 'links', event.target.value)}
                  disabled={busy}
                />
              )}
              <Button
                color="error"
                disabled={busy || rows.length === 1}
                onClick={() => {
                  onDirty()
                  setRows(rows.filter((_, position) => position !== index))
                }}
              >
                Remove category {index + 1}
              </Button>
            </Stack>
          ))}
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
            <Button
              disabled={busy || rows.length >= 30}
              onClick={() => {
                onDirty()
                setRows([...rows, blank()])
              }}
            >
              Add category
            </Button>
            <Button
              variant="outlined"
              disabled={busy || rows.some((row) => !row.name.trim())}
              onClick={persist}
            >
              Save categories
            </Button>
          </Stack>
          <Typography variant="body2">
            Save your categories before launching the phase below. Launching uses the last saved
            configuration.
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  )
}
function WinnerEditor({ edition, busy, save, onDirty }) {
  const [winners, setWinners] = useState(
    Object.fromEntries(
      edition.votingResults.map((result) => [result.categoryId, result.winnerIgdbId || ''])
    )
  )
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h5">Confirm winners</Typography>
          <Typography>
            Resolve ties manually. A category with no votes also requires an administrator’s choice.
            Saving winners keeps them private.
          </Typography>
          {edition.votingCategories.map((category) => (
            <FormControl key={category.id} fullWidth>
              <InputLabel id={`winner-label-${category.id}`}>Winner: {category.name}</InputLabel>
              <Select
                labelId={`winner-label-${category.id}`}
                label={`Winner: ${category.name}`}
                value={winners[category.id]}
                disabled={busy}
                onChange={(event) => {
                  onDirty()
                  setWinners({ ...winners, [category.id]: event.target.value })
                }}
              >
                {category.finalists.map((game) => (
                  <MenuItem key={game.igdbId} value={game.igdbId}>
                    {game.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ))}
          <Button
            variant="outlined"
            disabled={busy || Object.values(winners).some((value) => !value)}
            onClick={() =>
              save(Object.entries(winners).map(([categoryId, igdbId]) => ({ categoryId, igdbId })))
            }
          >
            Save confirmed winners
          </Button>
        </Stack>
      </CardContent>
    </Card>
  )
}
function Participation({ title, submissions, categories }) {
  return (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography>
          {title}: {submissions.length}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>
          {!submissions.length && <Typography>No submissions.</Typography>}
          {submissions.map((submission) => (
            <Stack key={submission.userId} spacing={0.5} sx={{ overflowWrap: 'anywhere' }}>
              <Typography fontWeight={700}>{submission.username}</Typography>
              <Typography variant="body2" color="text.secondary">
                Account: {submission.userId} ·{' '}
                {new Date(submission.submittedAt).toLocaleString('en-GB', {
                  timeZone: 'Europe/Rome'
                })}{' '}
                Europe/Rome
              </Typography>
              {submission.selections.map((selection) => (
                <Typography key={selection.categoryId}>
                  {categories.find((category) => category.id === selection.categoryId)?.name ||
                    selection.categoryId}
                  : {selection.games.map((game) => game.title).join(', ')}
                </Typography>
              ))}
              <Divider />
            </Stack>
          ))}
        </Stack>
      </AccordionDetails>
    </Accordion>
  )
}
function Results({ title, results, voting = false }) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h5">{title}</Typography>
          {results.map((result) => (
            <Stack key={result.categoryId} spacing={0.5}>
              <Typography variant="h6">{result.name}</Typography>
              {!result.games.length && <Typography>No nominations.</Typography>}
              {result.games.map((game) => (
                <Typography key={game.igdbId} sx={{ overflowWrap: 'anywhere' }}>
                  <Link href={game.igdbUrl} target="_blank" rel="noopener noreferrer">
                    {game.title}
                  </Link>{' '}
                  · {game.count}
                  {voting && result.winnerIgdbId === game.igdbId ? ' · Confirmed winner' : ''}
                </Typography>
              ))}
              {voting && result.tiedIgdbIds.length > 1 && (
                <Alert severity="info">
                  Tie for first place. Administrator confirmation required.
                </Alert>
              )}
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  )
}
export default function AdminAwards() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [closesAt, setClosesAt] = useState('')
  const [dirtyVersion, setDirtyVersion] = useState(null)
  const [now, setNow] = useState(Date.now())
  const load = useCallback(async () => {
    try {
      setData(await awardsApi.admin())
    } catch (requestError) {
      setError(requestError.message)
    }
  }, [])
  useEffect(() => {
    if (user?.role !== 'admin') return undefined
    load()
    const timer = setInterval(() => {
      setNow(Date.now())
      load()
    }, 30000)
    return () => clearInterval(timer)
  }, [user?.role, load])
  if (user?.role !== 'admin') return <Navigate to="/" />
  const run = async (action, message) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      setData(await action())
      setNotice(message)
    } catch (requestError) {
      setError(requestError.message)
      if (requestError.status === 409) await load()
    } finally {
      setBusy(false)
    }
  }
  const edition = data?.edition
  const transition = (action, message) => {
    if (
      !window.confirm(
        `${message} This action cannot be undone. The phase configuration and closing time cannot be edited after launch.`
      )
    )
      return
    run(() => awardsApi.transition(action, edition.version, closesAt), message).then(() =>
      setClosesAt('')
    )
  }
  const deadline =
    edition?.status === 'nominations'
      ? edition.nominationsCloseAt
      : edition?.status === 'voting'
        ? edition.votingClosesAt
        : null
  return (
    <Stack spacing={3} sx={{ maxWidth: 1100, mx: 'auto' }}>
      <Typography variant="h2">Game Awards administration</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {notice && <Alert severity="success">{notice}</Alert>}
      {!data && !error && <CircularProgress />}
      {data && !edition && (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h5">Edition {data.year}</Typography>
              <Typography>
                Prepare this year’s nomination categories, then launch nominations.
              </Typography>
              <Button
                disabled={busy}
                variant="contained"
                onClick={() => run(awardsApi.create, 'Edition created.')}
              >
                Create current-year edition
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}
      {edition && (
        <>
          {dirtyVersion === edition.version && (
            <Alert severity="info">
              Save your changes before launching a phase or publishing results.
            </Alert>
          )}
          <Stack direction="row" gap={2} alignItems="center">
            <Typography variant="h4">{edition.year}</Typography>
            <Chip label={edition.status} />
          </Stack>
          {deadline && (
            <Alert severity="info">
              Closes {new Date(deadline).toLocaleString('en-GB', { timeZone: 'Europe/Rome' })}{' '}
              Europe/Rome · {Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 60000))}{' '}
              minutes remaining
            </Alert>
          )}
          {['draft', 'review'].includes(edition.status) && (
            <>
              <CategoryEditor
                onDirty={() => setDirtyVersion(edition.version)}
                key={`${edition.id}:${edition.version}`}
                edition={edition}
                busy={busy}
                save={(categories) =>
                  run(() => awardsApi.categories(edition.version, categories), 'Categories saved.')
                }
              />
              <Card>
                <CardContent>
                  <Stack spacing={2}>
                    <Typography variant="h5">
                      Launch {edition.status === 'draft' ? 'nominations' : 'voting'}
                    </Typography>
                    <TextField
                      label="Closing date and time (Europe/Rome)"
                      type="datetime-local"
                      InputLabelProps={{ shrink: true }}
                      value={closesAt}
                      onChange={(event) => setClosesAt(event.target.value)}
                      disabled={busy}
                      helperText="Required when launching. The deadline is fixed for this phase."
                    />
                    <Button
                      variant="contained"
                      disabled={
                        busy ||
                        !closesAt ||
                        dirtyVersion === edition.version ||
                        !(edition.status === 'draft'
                          ? edition.nominationCategories.length
                          : edition.votingCategories.length &&
                            edition.votingCategories.every((category) => category.finalists.length))
                      }
                      onClick={() =>
                        transition(
                          edition.status === 'draft' ? 'start-nominations' : 'start-voting',
                          edition.status === 'draft' ? 'Nominations opened.' : 'Voting opened.'
                        )
                      }
                    >
                      {edition.status === 'draft'
                        ? 'Start nominations'
                        : 'Confirm shortlist and start voting'}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </>
          )}
          {edition.status === 'nominations' && (
            <Button
              disabled={busy}
              variant="outlined"
              onClick={() =>
                transition('close-nominations', 'Nominations closed. Review is now available.')
              }
            >
              Close nominations now
            </Button>
          )}
          {edition.status === 'voting' && (
            <Button
              disabled={busy}
              variant="outlined"
              onClick={() => transition('close-voting', 'Voting closed. Results remain private.')}
            >
              Close voting now
            </Button>
          )}
          {edition.nominationCategories.length > 0 && (
            <>
              <Results title="Nomination reference counts" results={edition.nominationCounts} />
              <Participation
                title="Nomination participation and raw selections"
                submissions={edition.nominations}
                categories={edition.nominationCategories}
              />
            </>
          )}
          {['voting', 'closed', 'published'].includes(edition.status) && (
            <>
              <Results title="Private voting totals" results={edition.votingResults} voting />
              <Participation
                title="Voter identities and ballots"
                submissions={edition.ballots}
                categories={edition.votingCategories}
              />
            </>
          )}
          {edition.status === 'closed' && (
            <>
              <WinnerEditor
                onDirty={() => setDirtyVersion(edition.version)}
                key={`winners-${edition.version}`}
                edition={edition}
                busy={busy}
                save={(winners) =>
                  run(
                    () => awardsApi.winners(edition.version, winners),
                    'Winners confirmed privately.'
                  )
                }
              />
              <Button
                variant="contained"
                disabled={
                  busy ||
                  dirtyVersion === edition.version ||
                  edition.votingResults.some((result) => !result.winnerIgdbId)
                }
                onClick={() => transition('publish', 'Results published.')}
              >
                Publish confirmed results
              </Button>
            </>
          )}
          {edition.status === 'published' && (
            <Alert severity="success">
              Winners are published on /awards. This edition is final.
            </Alert>
          )}
        </>
      )}
    </Stack>
  )
}
