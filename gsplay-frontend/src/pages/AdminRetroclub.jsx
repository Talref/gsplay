import { useEffect, useState } from 'react'
import { Navigate } from 'react-router'
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import ErrorNotice from '../components/ErrorNotice'
import { useAuth } from '../context/useAuth'
import { adminApi } from '../services/api'

export default function AdminRetroclub() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [game, setGame] = useState('')
  const [description, setDescription] = useState('')
  const [preview, setPreview] = useState(null)
  const [reason, setReason] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try {
      setData(await adminApi.retroclub())
    } catch (requestError) {
      setError(requestError.message)
    }
  }
  useEffect(() => { if (user?.role === 'admin') load() }, [user?.role])
  useEffect(() => { setDescription(data?.active?.description || '') }, [data?.active?.id, data?.active?.description])
  if (user?.role !== 'admin') return <Navigate to="/" />

  const run = async (action, success) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
      setNotice(success)
      await load()
      return true
    } catch (requestError) {
      setError(requestError.message)
      return false
    } finally {
      setBusy(false)
    }
  }
  const start = async () => {
    const saved = await run(
      () => adminApi.activateRetroChallenge(game, description),
      'Retroclub edition started.'
    )
    if (saved) {
      setGame('')
      setPreview(null)
    }
  }
  const previewGame = async () => {
    setBusy(true)
    setError('')
    try {
      setPreview((await adminApi.previewRetroGame(game)).game)
    } catch (requestError) {
      setPreview(null)
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }
  const cancel = () => {
    if (!window.confirm('Cancel the active Retroclub edition? Its progress remains stored for audit but will not appear publicly.')) return
    run(
      () => adminApi.cancelRetroChallenge(data.active.id, data.active.version, reason),
      'Retroclub edition cancelled.'
    ).then((saved) => saved && setReason(''))
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 1000, mx: 'auto' }}>
      <Typography variant="h2">Retroclub administration</Typography>
      {notice && <Alert severity="success">{notice}</Alert>}
      <ErrorNotice value={error} />
      {!data && <CircularProgress sx={{ alignSelf: 'center' }} />}
      <Card><CardContent>
        <Typography variant="h6">Linked accounts</Typography>
        <Typography variant="h3" sx={{ mt: 1 }}>{data?.accounts?.linked ?? '—'} / {data?.accounts?.total ?? '—'}</Typography>
        <Typography color="text.secondary">RetroAchievements accounts linked / GSPlay users</Typography>
      </CardContent></Card>

      {data && (data.active ? (
        <Card><CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
            <div><Typography variant="h6">Active edition</Typography><Typography variant="h4">{data.active.title}</Typography><Typography color="text.secondary">{data.active.monthKey} · {data.active.consoleName} · {data.active.summary.participants} participants</Typography></div>
            <Chip color="success" label="Active" />
          </Stack>
          <Divider sx={{ my: 2 }} />
          <TextField fullWidth multiline minRows={3} label="Curated description" value={description} onChange={(event) => setDescription(event.target.value)} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
            <Button disabled={busy} variant="contained" onClick={() => run(() => adminApi.updateRetroDescription(data.active.id, data.active.version, description), 'Description updated.')}>Save description</Button>
            <Button disabled={busy} variant="outlined" onClick={() => run(() => adminApi.refreshRetroChallenge(data.active.id), 'Progress refreshed.')}>Refresh progress now</Button>
          </Stack>
          <Divider sx={{ my: 2 }} />
          <TextField fullWidth label="Cancellation reason" value={reason} onChange={(event) => setReason(event.target.value)} />
          <Button color="error" variant="outlined" disabled={busy || !reason.trim()} onClick={cancel} sx={{ mt: 1 }}>Cancel edition</Button>
        </CardContent></Card>
      ) : (
        <Card><CardContent>
          <Typography variant="h6">Start an edition</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>Achievements earned since the first day of the current Europe/Rome month are counted, including those earned before activation.</Typography>
          <Stack spacing={2}>
            <TextField required label="RetroAchievements game URL or numeric ID" value={game} onChange={(event) => setGame(event.target.value)} />
            {preview && <Alert severity="info">{preview.title} · {preview.consoleName} · {preview.achievementCount} achievements</Alert>}
            <TextField multiline minRows={3} label="Curated description" value={description} onChange={(event) => setDescription(event.target.value)} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button variant="outlined" disabled={busy || !game.trim()} onClick={previewGame}>Preview game</Button>
              <Button variant="contained" disabled={busy || !game.trim()} onClick={start}>Start current-month edition</Button>
            </Stack>
          </Stack>
        </CardContent></Card>
      ))}

      <Card><CardContent>
        <Typography variant="h6">Recent editions</Typography>
        <Divider sx={{ my: 1 }} />
        <Stack spacing={1}>
          {data?.editions?.map((edition) => (
            <Stack key={edition.id} direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" sx={{ p: 1 }}>
              <Typography>{edition.monthKey} · {edition.title}</Typography>
              <Typography color="text.secondary">{edition.status} · {edition.summary.participants} participants</Typography>
            </Stack>
          ))}
          {data && !data.editions.length && <Typography color="text.secondary">No editions yet.</Typography>}
        </Stack>
      </CardContent></Card>
    </Stack>
  )
}
