import { useCallback, useEffect, useState } from 'react'
import { Alert, Stack, Typography } from '@mui/material'
import LibraryDialogs from '../components/library/LibraryDialogs'
import LibraryGameGrid from '../components/library/LibraryGameGrid'
import LibrarySources from '../components/library/LibrarySources'
import { useAuth } from '../context/useAuth'
import useInfiniteScroll from '../hooks/useInfiniteScroll'
import { libraryApi } from '../services/api'

export default function Library() {
  const { user, refresh } = useAuth()
  const [items, setItems] = useState([])
  const [page, setPage] = useState({ number: 0, size: 60, total: 0 })
  const [loading, setLoading] = useState(true)
  const [libraryError, setLibraryError] = useState('')
  const [steamId, setSteamId] = useState('')
  const [editingSteam, setEditingSteam] = useState(false)
  const [provider, setProvider] = useState('gog')
  const [file, setFile] = useState(null)
  const [message, setMessage] = useState('')
  const [jobId, setJobId] = useState(null)
  const [job, setJob] = useState(null)
  const [help, setHelp] = useState(null)
  const [removeItem, setRemoveItem] = useState(null)
  const loadLibrary = useCallback(
    async (nextPage, replace = false) => {
      setLoading(true)
      setLibraryError('')
      try {
        const response = await libraryApi.mine(nextPage, page.size)
        setItems((current) => (replace ? response.items : [...current, ...response.items]))
        setPage(response.page)
      } catch (error) {
        setLibraryError(error.message)
      } finally {
        setLoading(false)
      }
    },
    [page.size]
  )
  useEffect(() => {
    loadLibrary(1, true)
  }, [loadLibrary])
  useEffect(() => {
    if (!jobId || ['completed', 'completed_with_errors', 'failed'].includes(job?.status))
      return undefined
    const poll = async () => {
      try {
        const result = await libraryApi.job(jobId)
        setJob(result.job)
        if (['completed', 'completed_with_errors'].includes(result.job.status)) {
          await refresh()
          await loadLibrary(1, true)
        }
      } catch (error) {
        setMessage(error.message)
      }
    }
    poll()
    const timer = setInterval(poll, 2000)
    return () => clearInterval(timer)
  }, [jobId, job?.status, loadLibrary, refresh])
  const run = async (action) => {
    try {
      const result = await action()
      if (result?.job) {
        setJobId(result.job.id)
        setJob({ ...result.job, status: result.job.status || 'queued' })
        setMessage(
          `Coda fatta${result.job.gameCount ? `: ${result.job.gameCount} giochi ar macero` : ''}.`
        )
      } else {
        setMessage('Salvato. Mica pizza e fichi.')
        await refresh()
        setSteamId('')
        setEditingSteam(false)
      }
    } catch {
      setMessage('Aò, qualcosa s’è incartato. Riprova tra poco.')
    }
  }
  const jobNotice = job && (
    <Alert
      severity={
        job.status === 'failed'
          ? 'error'
          : job.status === 'completed_with_errors'
            ? 'warning'
            : job.status === 'completed'
              ? 'success'
              : 'info'
      }
    >
      {job.status === 'completed'
        ? 'Fatto, daje.'
        : job.status === 'failed'
          ? 'È annata male, porca paletta.'
          : 'Stamo a lavoracce sopra…'}
      {job.counts?.discovered !== undefined
        ? ` · ${job.counts.discovered} trovati, ${job.counts.created} aggiunti, ${job.counts.updated} aggiornati`
        : ''}
    </Alert>
  )
  const hasMore = items.length < page.total
  const loadMore = useCallback(() => loadLibrary(page.number + 1), [loadLibrary, page.number])
  const loadMoreRef = useInfiniteScroll({ hasMore, loading, onLoadMore: loadMore })
  const removeManual = async () => {
    try {
      await libraryApi.removeManualGame(removeItem.canonicalGame.id)
      setRemoveItem(null)
      setMessage('Le aggiunta manuale è stata levata dalla libbreria.')
      await loadLibrary(1, true)
    } catch (error) {
      setMessage(error.message)
    }
  }
  return (
    <Stack spacing={3}>
      <Typography variant="h2">La tua libbreria</Typography>
      {message && <Alert severity="info">{message}</Alert>}
      {jobNotice}
      {libraryError && (
        <Alert severity="error">Aò, la libbreria s’è impicciata: riprova tra poco.</Alert>
      )}
      <LibrarySources
        user={user}
        steamId={steamId}
        onSteamIdChange={setSteamId}
        editingSteam={editingSteam}
        onEditSteam={() => setEditingSteam(true)}
        provider={provider}
        onProviderChange={setProvider}
        file={file}
        onFileChange={setFile}
        onShowHelp={setHelp}
        onLinkSteam={() => run(() => libraryApi.linkSteam(steamId))}
        onSyncSteam={() => run(libraryApi.syncSteam)}
        onUpload={() => run(() => libraryApi.upload(provider, file))}
      />
      {page.total > 0 && (
        <Typography color="text.secondary">{page.total} giochi. Roba seria, insomma.</Typography>
      )}
      <LibraryGameGrid
        items={items}
        loading={loading}
        hasMore={hasMore}
        sentinelRef={loadMoreRef}
        onRemove={setRemoveItem}
      />
      <LibraryDialogs
        help={help}
        onCloseHelp={() => setHelp(null)}
        removeItem={removeItem}
        onCloseRemove={() => setRemoveItem(null)}
        onRemove={removeManual}
      />
    </Stack>
  )
}
