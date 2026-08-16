import { lazy, useState } from 'react'
import { Navigate } from 'react-router'
import {
  Alert,
  Button,
  Card,
  CardContent,
  Collapse,
  Divider,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import ErrorNotice from '../components/ErrorNotice'
import { useAuth } from '../context/useAuth'
import { useLoad } from '../hooks/useLoad'
import { adminApi } from '../services/api'

const AdminUsers = lazy(() => import('./AdminUsers'))

export default function Admin() {
  const { user } = useAuth()
  const jobs = useLoad(adminApi.jobs, [])
  const coverage = useLoad(adminApi.accountCoverage, [])
  const [enrichmentVersion, setEnrichmentVersion] = useState(0)
  const enrichment = useLoad(adminApi.enrichmentStatus, [enrichmentVersion])
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [coverageExpanded, setCoverageExpanded] = useState(false)
  const [retroGameId, setRetroGameId] = useState('')
  const [retroDescription, setRetroDescription] = useState('')

  if (user?.role !== 'admin') return <Navigate to="/" />

  const activateChallenge = async () => {
    try {
      await adminApi.activateRetroChallenge(retroGameId, retroDescription)
      setNotice('Retro challenge activated.')
      setRetroGameId('')
      setRetroDescription('')
    } catch (err) {
      setError(err.message)
    }
  }

  const recover = async () => {
    try {
      await adminApi.recoverEnrichment()
      setNotice('IGDB recovery scan queued.')
      setEnrichmentVersion((version) => version + 1)
    } catch (err) {
      setError(err.message)
    }
  }

  const reset = async () => {
    if (
      !window.confirm(
        'Reset every terminal IGDB enrichment to pending? This will requeue them for provider processing.'
      )
    )
      return
    try {
      const result = await adminApi.resetEnrichment()
      setNotice(`${result.reset || 0} terminal IGDB enrichments reset and queued.`)
      setEnrichmentVersion((version) => version + 1)
    } catch (err) {
      setError(err.message)
    }
  }

  const refreshAll = async () => {
    if (
      !window.confirm(
        'Refresh every active catalogue record from IGDB? This is a background job, may take time, and uses your IGDB quota.'
      )
    )
      return
    try {
      const result = await adminApi.refreshAllMetadata()
      setNotice(
        result.coalesced
          ? 'A full catalogue IGDB refresh is already queued.'
          : 'Full catalogue IGDB refresh queued.'
      )
      setEnrichmentVersion((version) => version + 1)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h2">Admin operations</Typography>
      {notice && <Alert severity="success">{notice}</Alert>}
      <ErrorNotice value={error || jobs.error || coverage.error || enrichment.error} />
      <Card>
        <CardContent>
          <Typography variant="h6">Users and Steam coverage</Typography>
          <Stack direction="row" flexWrap="wrap" gap={2} sx={{ mt: 1 }}>
            <Typography color="text.secondary">
              Users {coverage.data?.totalUsers ?? '—'}
            </Typography>
            <Typography color="text.secondary">
              Steam linked {coverage.data?.steam?.linked ?? '—'}
            </Typography>
            <Typography color="text.secondary">
              Libraries verified {coverage.data?.steam?.librariesVerified ?? '—'}
            </Typography>
            <Typography color="text.secondary">
              Wishlists with games {coverage.data?.steam?.wishlistsWithGames ?? '—'}
            </Typography>
            <Typography color="text.secondary">
              Empty wishlists {coverage.data?.steam?.emptyWishlists ?? '—'}
            </Typography>
            <Typography color="text.secondary">
              Unavailable {coverage.data?.steam?.unavailableWishlists ?? '—'}
            </Typography>
            <Typography color="text.secondary">
              Cached {coverage.data?.steam?.cachedWishlists ?? '—'}
            </Typography>
            <Typography color="text.secondary">
              Not checked {coverage.data?.steam?.unchecked ?? '—'}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Last wishlist check:{' '}
            {coverage.data?.steam?.lastCheckedAt
              ? new Date(coverage.data.steam.lastCheckedAt).toLocaleString()
              : 'never'}
          </Typography>
          {coverage.data?.attention?.length > 0 && (
            <>
              <Button
                size="small"
                variant="outlined"
                sx={{ mt: 2 }}
                onClick={() => setCoverageExpanded((expanded) => !expanded)}
              >
                {coverageExpanded ? 'Hide' : 'Show'} profiles requiring attention (
                {coverage.data.attention.length})
              </Button>
              <Collapse in={coverageExpanded}>
                <Stack spacing={0.75} sx={{ mt: 1.5 }}>
                  {coverage.data.attention.map((profile) => (
                    <Typography key={profile.id} variant="body2" color="text.secondary">
                      {profile.username} · {profile.wishlistOutcome} ·{' '}
                      {profile.errorCode || 'cached data'} · library sync{' '}
                      {profile.lastLibrarySyncAt
                        ? new Date(profile.lastLibrarySyncAt).toLocaleString()
                        : 'never'}{' '}
                      ·{' '}
                      <a
                        href={`https://steamcommunity.com/profiles/${profile.steamId}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Steam profile
                      </a>
                    </Typography>
                  ))}
                </Stack>
              </Collapse>
            </>
          )}
        </CardContent>
      </Card>
      <AdminUsers />
      <Card>
        <CardContent>
          <Typography variant="h6">IGDB catalogue metadata</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {enrichment.data?.metadata?.complete || 0}/{enrichment.data?.metadata?.total || 0}{' '}
            complete · {enrichment.data?.metadata?.enrichedPercent || 0}%
          </Typography>
          <Typography color="text.secondary">
            Pending {enrichment.data?.metadata?.pending || 0} · Failed{' '}
            {enrichment.data?.metadata?.failed || 0}
          </Typography>
          <Typography color="text.secondary">
            Queue limit {enrichment.data?.scheduler?.queueLimit || '—'} · interval{' '}
            {enrichment.data?.scheduler?.minIntervalMs || '—'}ms
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
            <Button variant="contained" onClick={recover}>
              Queue missing or pending IGDB metadata
            </Button>
            <Button variant="outlined" onClick={refreshAll}>
              Refresh all catalogue metadata from IGDB
            </Button>
            <Button color="error" variant="outlined" onClick={reset}>
              Retry all failed IGDB matches
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            The full refresh preserves ownership and processes active catalogue records through the
            existing bounded queue. Use Catalogue admin to refresh one selected game.
          </Typography>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6">Activate Retro challenge</Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mt: 2 }}>
            <TextField
              required
              label="RetroAchievements game ID"
              value={retroGameId}
              onChange={(event) => setRetroGameId(event.target.value)}
            />
            <TextField
              fullWidth
              label="Challenge description (optional)"
              value={retroDescription}
              onChange={(event) => setRetroDescription(event.target.value)}
            />
            <Button variant="contained" disabled={!retroGameId} onClick={activateChallenge}>
              Activate
            </Button>
          </Stack>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6">Recent durable jobs</Typography>
          <Divider sx={{ my: 1 }} />
          {jobs.data?.jobs?.slice(0, 10).map((job) => (
            <Typography key={job._id} color="text.secondary">
              {job.provider} · {job.kind} · {job.status} · attempt {job.attempts}
            </Typography>
          ))}
        </CardContent>
      </Card>
    </Stack>
  )
}
