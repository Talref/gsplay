import { useCallback, useEffect, useState } from 'react'
import { Alert, Snackbar, Stack, Typography } from '@mui/material'
import { Navigate } from 'react-router'
import { adminApi } from '../services/api'
import { useAuth } from '../context/useAuth'
import useInfiniteScroll from '../hooks/useInfiniteScroll'
import CatalogueCreation from '../components/admin/CatalogueCreation'
import CatalogueEditor from '../components/admin/CatalogueEditor'
import MetadataReviewQueue from '../components/admin/MetadataReviewQueue'
import { emptyMetadata, metadataPayload } from '../components/admin/metadata'

export default function AdminCatalogue() {
  const { user } = useAuth()
  const [version, setVersion] = useState(0)
  const [reviews, setReviews] = useState([])
  const [reviewPage, setReviewPage] = useState({ number: 0, size: 30, total: 0 })
  const [reviewLoading, setReviewLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [manual, setManual] = useState(emptyMetadata)
  const [igdbUrl, setIgdbUrl] = useState('')
  const [selected, setSelected] = useState(null)
  const [draft, setDraft] = useState(emptyMetadata)
  const [selectedIgdbUrl, setSelectedIgdbUrl] = useState('')
  const [mergeTarget, setMergeTarget] = useState(null)
  const [reason, setReason] = useState('')
  const [identities, setIdentities] = useState([])
  const [selectedIdentity, setSelectedIdentity] = useState(null)
  const [reviewUrls, setReviewUrls] = useState({})
  const [manualReviewId, setManualReviewId] = useState(null)
  const [manualReview, setManualReview] = useState(emptyMetadata)
  const selectedId = selected?.id
  const targetId = mergeTarget?.id
  const refresh = () => setVersion((current) => current + 1)
  const report = (message) => {
    setNotice(message)
    setError('')
  }
  const loadReviews = useCallback(
    async (nextPage, replace = false) => {
      setReviewLoading(true)
      try {
        const response = await adminApi.metadataReviews(nextPage, reviewPage.size)
        setReviews((current) => (replace ? response.reviews : [...current, ...response.reviews]))
        setReviewPage(response.page)
      } catch (err) {
        setError(err.message)
      } finally {
        setReviewLoading(false)
      }
    },
    [reviewPage.size]
  )
  useEffect(() => {
    loadReviews(1, true)
  }, [loadReviews, version])
  const hasMoreReviews = reviews.length < reviewPage.total
  const loadMoreReviews = useCallback(
    () => loadReviews(reviewPage.number + 1),
    [loadReviews, reviewPage.number]
  )
  const reviewSentinel = useInfiniteScroll({
    hasMore: hasMoreReviews,
    loading: reviewLoading,
    onLoadMore: loadMoreReviews
  })
  const select = (game) => {
    setSelected(game || null)
    setSelectedIgdbUrl('')
    setMergeTarget(null)
    setReason('')
    setIdentities([])
    setSelectedIdentity(null)
    setDraft(
      game
        ? {
            title: game.title,
            summary: game.summary || '',
            artwork: game.artwork || '',
            genres: (game.genres || []).join(', '),
            platforms: (game.platforms || []).join(', '),
            releaseDate: game.releaseDate ? game.releaseDate.slice(0, 10) : ''
          }
        : emptyMetadata
    )
  }
  useEffect(() => {
    if (!selectedId) return undefined
    let active = true
    adminApi
      .providerIdentities(selectedId)
      .then((response) => {
        if (active) setIdentities(response.identities)
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
    return () => {
      active = false
    }
  }, [selectedId, version])
  const save = async () => {
    try {
      const result = await adminApi.updateGame(selectedId, {
        ...metadataPayload(draft)
      })
      report(`Successfully updated ${result.game.title}.`)
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }
  const addManual = async () => {
    try {
      const result = await adminApi.createGame({
        ...metadataPayload(manual),
        releaseDate: manual.releaseDate || undefined,
        independent: true
      })
      report(`${result.game.title} added with the supplied metadata.`)
      setManual(emptyMetadata)
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }
  const addIgdb = async () => {
    try {
      const result = await adminApi.createFromIgdbUrl(igdbUrl)
      report(
        result.created
          ? `${result.game.title} was imported from verified IGDB metadata.`
          : `${result.game.title} already exists; no duplicate was created.`
      )
      setIgdbUrl('')
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }
  const attachIgdbUrl = async () => {
    try {
      const result = await adminApi.assignIgdbUrl(selectedId, selectedIgdbUrl)
      select(result.game)
      report(resolutionMessage(result, selected.title))
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }
  const refreshSelectedMetadata = async () => {
    try {
      const result = await adminApi.refreshGameMetadata(selectedId)
      report(
        result.coalesced
          ? `An IGDB refresh for ${selected.title} is already queued.`
          : `IGDB metadata refresh queued for ${selected.title}.`
      )
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }
  const removeReview = (id) =>
    setReviews((current) => current.filter((review) => review.game.id !== id))
  const resolutionMessage = (result, sourceTitle) =>
    result.merged
      ? `${sourceTitle} was merged into ${result.game.title} based on the verified IGDB identity.`
      : `Verified IGDB metadata attached to ${result.game.title}.`
  const resolveReviewUrl = async (id) => {
    try {
      const result = await adminApi.assignIgdbUrl(id, reviewUrls[id])
      report(
        resolutionMessage(
          result,
          reviews.find((review) => review.game.id === id)?.game.title || 'Game'
        )
      )
      removeReview(id)
    } catch (err) {
      setError(err.message)
    }
  }
  const resolveReviewManual = async (id) => {
    try {
      const result = await adminApi.manualMetadata(id, {
        ...metadataPayload(manualReview)
      })
      report(`Manual metadata saved for ${result.game.title}.`)
      setManualReviewId(null)
      removeReview(id)
    } catch (err) {
      setError(err.message)
    }
  }
  const toggleManualReview = (review) => {
    const opening = manualReviewId !== review.game.id
    setManualReviewId(opening ? review.game.id : null)
    if (!opening) return
    setManualReview({
      title: review.game.title,
      summary: review.game.summary || '',
      artwork: review.game.artwork || '',
      genres: (review.game.genres || []).join(', '),
      platforms: (review.game.platforms || []).join(', '),
      releaseDate: review.game.releaseDate ? review.game.releaseDate.slice(0, 10) : ''
    })
  }
  const hide = async (id) => {
    try {
      const result = await adminApi.setVisibility(id, true)
      report(`Successfully hid ${result.game.title} from the catalogue.`)
      if (selectedId === id) select(null)
      removeReview(id)
    } catch (err) {
      setError(err.message)
    }
  }
  const unhide = async () => {
    try {
      const result = await adminApi.setVisibility(selectedId, false)
      select(result.game)
      report(`${result.game.title} is visible again.`)
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }
  const choose = async (gameId, igdbId) => {
    try {
      const result = await adminApi.assignIgdb(gameId, igdbId)
      report(
        resolutionMessage(
          result,
          reviews.find((review) => review.game.id === gameId)?.game.title || 'Game'
        )
      )
      removeReview(gameId)
    } catch (err) {
      setError(err.message)
    }
  }
  const merge = async () => {
    try {
      await adminApi.mergeGames(selectedId, targetId, reason || 'Admin catalogue consolidation')
      report('Games merged; entitlements and aliases now reference the survivor.')
      select(null)
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }
  const reassign = async () => {
    if (!selectedIdentity || !targetId) return
    if (
      !window.confirm(
        `Move ${selectedIdentity.provider} ${selectedIdentity.providerGameId} for ${selectedIdentity.affectedUserCount} active owner(s) to ${mergeTarget.title}?`
      )
    )
      return
    try {
      const result = await adminApi.reassignProviderGame(selectedId, {
        provider: selectedIdentity.provider,
        providerGameId: selectedIdentity.providerGameId,
        targetGameId: targetId,
        confirmation: 'REASSIGN PROVIDER GAME',
        reason: reason || 'Admin correction of a collapsed catalogue record'
      })
      report(
        `Moved ${result.activeEntitlementCount} entitlement(s) across ${result.affectedUserCount} owner(s) to ${result.targetGame.title}. Future syncs will preserve this correction.`
      )
      setSelectedIdentity(null)
      setMergeTarget(null)
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }
  const archive = async () => {
    if (!window.confirm('Archive this unreferenced game? Referenced games must be merged instead.'))
      return
    try {
      await adminApi.archiveGame(selectedId, reason)
      report('Unreferenced catalogue record archived.')
      select(null)
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }
  if (user?.role !== 'admin') return <Navigate to="/" />
  return (
    <>
      <Stack spacing={3}>
        <Typography variant="h2">Catalogue stewardship</Typography>
        <Typography color="text.secondary">
          Edit bad titles, refresh verified IGDB metadata, safely merge duplicates, and repair
          collapsed provider identities without asking members to do anything.
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <CatalogueCreation
          igdbUrl={igdbUrl}
          onIgdbUrlChange={setIgdbUrl}
          onImport={addIgdb}
          manual={manual}
          onManualChange={setManual}
          onAddManual={addManual}
        />
        <CatalogueEditor
          loadGames={adminApi.games}
          selected={selected}
          onSelect={select}
          igdbUrl={selectedIgdbUrl}
          onIgdbUrlChange={setSelectedIgdbUrl}
          onAttachIgdb={attachIgdbUrl}
          onRefreshMetadata={refreshSelectedMetadata}
          draft={draft}
          onDraftChange={setDraft}
          onSave={save}
          onHide={hide}
          onUnhide={unhide}
          identities={identities}
          selectedIdentity={selectedIdentity}
          onIdentitySelect={setSelectedIdentity}
          mergeTarget={mergeTarget}
          onMergeTargetSelect={setMergeTarget}
          reason={reason}
          onReasonChange={setReason}
          onReassign={reassign}
          onMerge={merge}
          onArchive={archive}
        />
        <MetadataReviewQueue
          reviews={reviews}
          reviewUrls={reviewUrls}
          onReviewUrlChange={(id, value) =>
            setReviewUrls((current) => ({ ...current, [id]: value }))
          }
          onChooseCandidate={choose}
          onResolveUrl={resolveReviewUrl}
          manualReviewId={manualReviewId}
          manualReview={manualReview}
          onToggleManual={toggleManualReview}
          onManualReviewChange={setManualReview}
          onResolveManual={resolveReviewManual}
          onHide={hide}
          loading={reviewLoading}
          hasMore={hasMoreReviews}
          sentinelRef={reviewSentinel}
        />
      </Stack>
      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={4200}
        onClose={() => setNotice('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setNotice('')}>
          {notice}
        </Alert>
      </Snackbar>
      <Snackbar
        open={Boolean(error)}
        autoHideDuration={6000}
        onClose={() => setError('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" variant="filled" onClose={() => setError('')}>
          {error}
        </Alert>
      </Snackbar>
    </>
  )
}
