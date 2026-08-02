import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded'
import Groups2RoundedIcon from '@mui/icons-material/Groups2Rounded'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import SportsEsportsRoundedIcon from '@mui/icons-material/SportsEsportsRounded'
import VpnKeyRoundedIcon from '@mui/icons-material/VpnKeyRounded'
import { Navigate } from 'react-router'
import CatalogueGameSearch from '../components/CatalogueGameSearch'
import { catalogueApi, casualFridayApi } from '../services/api'
import { useAuth } from '../context/useAuth'

const blank = {
  displayTitle: '',
  artworkOverride: '',
  info: '',
  playerCountMin: 2,
  playerCountMax: 8,
  playerCountLabel: '',
  joinInstructions: '',
  hostMode: 'none',
  acquisitionKind: 'owned_store',
  acquisitionUrl: '',
  availabilityNote: ''
}
const gameLoader = (query, page, pageSize) => catalogueApi.games({ query, page, pageSize })
const requestMessage = (error) =>
  error.code === 'rotation_game_exists'
    ? 'This game is already in the active rotation.'
    : error.code === 'invalid_request' && error.details?.fields?.length
      ? `Some fields are not supported here: ${error.details.fields.join(', ')}.`
      : error.message
const itadMessage = (item) =>
  item.itad.status === 'verified'
    ? 'ITAD verified'
    : item.itad.status === 'not_required'
      ? 'ITAD not required'
      : item.itad.status === 'ambiguous'
        ? 'ITAD found multiple possible matches. Recheck after the backend matching flow is configured.'
        : item.itad.status === 'not_found'
          ? 'ITAD could not find this title'
          : item.itad.status === 'error'
            ? `ITAD verification unavailable${item.itad.error ? `: ${item.itad.error}` : '.'}`
            : 'ITAD verification pending'
const modeLabel = (mode) =>
  mode === 'host_runs' ? 'Remote Play' : mode === 'streamable' ? 'Streaming' : 'Client'
const money = (amount, currency) =>
  Number.isFinite(amount)
    ? new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'EUR' }).format(
        amount
      )
    : null
const withPositions = (entries) =>
  entries.map((entry, index) => ({ ...entry, position: index + 1 }))
const rotationPayload = (value) => ({
  displayTitle: value.displayTitle,
  artworkOverride: value.artworkOverride || '',
  info: value.info || '',
  playerCountMin: Number(value.playerCountMin),
  playerCountMax: Number(value.playerCountMax),
  playerCountLabel: value.playerCountLabel || '',
  joinInstructions: value.joinInstructions || '',
  hostMode: value.hostMode,
  acquisitionKind: value.acquisitionKind,
  acquisitionUrl: value.acquisitionUrl || '',
  availabilityNote: value.availabilityNote || ''
})

function OfferChip({ offer }) {
  if (!offer) return null
  const price = money(offer.price, offer.currency)
  const voucher = offer.voucher ? ` · code ${offer.voucher}` : ''
  return (
    <Tooltip
      title={`Buy at ${offer.shop}${Number.isFinite(offer.discountPercent) && offer.discountPercent > 0 ? ` · ${offer.discountPercent}% off` : ''}${voucher}`}
    >
      <Chip
        component="a"
        href={offer.url}
        target="_blank"
        rel="noopener noreferrer"
        clickable
        size="small"
        color="primary"
        variant="outlined"
        icon={<LocalOfferRoundedIcon />}
        label={`${price}${voucher}`}
        aria-label={`Buy at ${offer.shop} for ${price}${offer.voucher ? ` with code ${offer.voucher}` : ''}`}
      />
    </Tooltip>
  )
}

function KeyOfferChip({ offer }) {
  if (!offer) return null
  const price = money(offer.price, offer.currency)
  return (
    <Tooltip title="Manually checked key-market offer">
      <Chip
        component="a"
        href={offer.url}
        target="_blank"
        rel="noopener noreferrer"
        clickable
        size="small"
        color="secondary"
        variant="outlined"
        icon={<VpnKeyRoundedIcon />}
        label={`${price} · key available`}
        aria-label={`Key available for ${price}`}
      />
    </Tooltip>
  )
}

function PlaylistEntryCard({
  entry,
  index,
  count,
  editable,
  dragging,
  saving,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMove,
  onRemove,
  onInfo,
  onKeyOffer
}) {
  const title = entry.rotation.displayTitle || entry.game.title
  const offer = entry.itad?.status === 'verified' ? entry.itad.offer : null
  const acquisitionUrl = entry.rotation.acquisitionUrl
  const canAcquireDirectly =
    ['free', 'web', 'external_store'].includes(entry.rotation.acquisitionKind) && acquisitionUrl
  return (
    <Card
      component="article"
      draggable={editable && !saving}
      onDragStart={(event) => onDragStart(event, entry.id)}
      onDragOver={(event) => onDragOver(event, entry.id)}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      sx={{
        opacity: dragging === entry.id ? 0.55 : 1,
        borderColor: dragging === entry.id ? 'primary.main' : 'divider',
        bgcolor: 'rgba(10,21,41,.72)',
        cursor: editable ? (dragging === entry.id ? 'grabbing' : 'grab') : 'default',
        transition: 'opacity 120ms ease, border-color 120ms ease',
        '&:hover': { borderColor: editable ? 'rgba(127,255,212,.42)' : 'divider' }
      }}
    >
      <CardContent
        sx={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: { xs: '88px minmax(0,1fr)', sm: '112px minmax(0,1fr) auto' },
          gap: { xs: 1.5, sm: 2.25 },
          p: { xs: 1.5, sm: 2 },
          '&:last-child': { pb: { xs: 1.5, sm: 2 } }
        }}
      >
        <Box sx={{ position: 'relative', minWidth: 0 }}>
          <Box
            component="img"
            src={entry.rotation.artwork || entry.game.artwork || '/placeholder-game.jpg'}
            alt=""
            sx={{
              display: 'block',
              width: '100%',
              aspectRatio: '3 / 4',
              objectFit: 'cover',
              borderRadius: 1.5,
              bgcolor: 'background.default'
            }}
          />
          <Chip
            size="small"
            label={`#${entry.position}`}
            color="primary"
            sx={{ position: 'absolute', left: 6, top: 6, fontWeight: 800, boxShadow: 2 }}
          />
        </Box>
        <Stack spacing={1} sx={{ minWidth: 0, overflow: 'hidden', pr: { xs: 0, sm: 1 } }}>
          <Stack direction="row" alignItems="flex-start" gap={0.5}>
            {editable && (
              <DragIndicatorRoundedIcon
                aria-hidden="true"
                sx={{
                  display: { xs: 'none', sm: 'block' },
                  flexShrink: 0,
                  color: 'text.disabled',
                  mt: 0.35,
                  ml: -0.75
                }}
              />
            )}
            <Typography
              variant="h6"
              color="primary"
              title={title}
              sx={{
                lineHeight: 1.25,
                overflow: 'hidden',
                overflowWrap: 'anywhere',
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 2
              }}
            >
              {title}
            </Typography>
          </Stack>
          <Stack direction="row" flexWrap="wrap" gap={0.75}>
            <Chip
              size="small"
              icon={<Groups2RoundedIcon />}
              label={
                entry.rotation.playerCountLabel ||
                `${entry.rotation.playerCountMin}–${entry.rotation.playerCountMax} players`
              }
            />
            <Chip
              size="small"
              variant="outlined"
              icon={<SportsEsportsRoundedIcon />}
              label={modeLabel(entry.rotation.hostMode)}
            />
            {entry.free && <Chip size="small" color="success" label="Free" />}
            <OfferChip offer={offer} />
            <KeyOfferChip offer={entry.keyOffer} />
          </Stack>
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            <Button size="small" startIcon={<InfoOutlinedIcon />} onClick={() => onInfo(entry)}>
              Player info
            </Button>
            {editable && (
              <Button
                size="small"
                startIcon={<VpnKeyRoundedIcon />}
                disabled={saving}
                onClick={() => onKeyOffer(entry)}
              >
                {entry.keyOffer ? 'Edit key offer' : 'Add key offer'}
              </Button>
            )}
          </Stack>
          {!offer && canAcquireDirectly && (
            <Button
              component="a"
              href={acquisitionUrl}
              target="_blank"
              rel="noopener noreferrer"
              size="small"
              variant="outlined"
              endIcon={<OpenInNewRoundedIcon />}
              sx={{ alignSelf: 'flex-start' }}
            >
              Get / play game
            </Button>
          )}
          {entry.itad?.offerError && (
            <Alert severity="warning" sx={{ py: 0 }}>
              Price lookup failed: {entry.itad.offerError}
            </Alert>
          )}
        </Stack>
        {editable && (
          <Stack
            direction={{ xs: 'row', sm: 'column' }}
            spacing={0.25}
            sx={{
              gridColumn: { xs: '1 / -1', sm: 'auto' },
              justifyContent: { xs: 'flex-end', sm: 'flex-start' },
              alignItems: 'center'
            }}
          >
            <Tooltip title="Move up">
              <span>
                <IconButton
                  size="small"
                  disabled={saving || index === 0}
                  aria-label={`Move ${title} up`}
                  onClick={() => onMove(index, index - 1)}
                >
                  <ArrowUpwardRoundedIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Move down">
              <span>
                <IconButton
                  size="small"
                  disabled={saving || index === count - 1}
                  aria-label={`Move ${title} down`}
                  onClick={() => onMove(index, index + 1)}
                >
                  <ArrowDownwardRoundedIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Remove from playlist">
              <span>
                <IconButton
                  size="small"
                  disabled={saving}
                  color="error"
                  aria-label={`Remove ${title} from playlist`}
                  onClick={() => onRemove(entry)}
                >
                  <DeleteOutlineRoundedIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        )}
      </CardContent>
    </Card>
  )
}

export default function CasualFridayManage() {
  const { user } = useAuth()
  const [rotation, setRotation] = useState([])
  const [playlist, setPlaylist] = useState(null)
  const [game, setGame] = useState(null)
  const [form, setForm] = useState(blank)
  const [tab, setTab] = useState(0)
  const [igdbUrl, setIgdbUrl] = useState('')
  const [edit, setEdit] = useState(null)
  const [infoEntry, setInfoEntry] = useState(null)
  const [keyOfferEntry, setKeyOfferEntry] = useState(null)
  const [keyOfferForm, setKeyOfferForm] = useState({ price: '', url: '' })
  const [savingKeyOffer, setSavingKeyOffer] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancellationReason, setCancellationReason] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(null)
  const [savingOrder, setSavingOrder] = useState(false)
  const playlistRef = useRef(null)
  const dragCommittedRef = useRef(false)
  const dragStartEntriesRef = useRef([])
  playlistRef.current = playlist
  const replacePlaylist = useCallback((value) => {
    playlistRef.current = value
    setPlaylist(value)
  }, [])
  const reload = useCallback(
    () =>
      Promise.all([casualFridayApi.rotation(), casualFridayApi.playlist()])
        .then(([rotations, current]) => {
          setRotation(rotations.rotation)
          replacePlaylist(current.playlist)
        })
        .catch((err) => setError(err.message)),
    [replacePlaylist]
  )
  useEffect(() => {
    if (user?.role === 'helper' || user?.role === 'admin') reload()
  }, [reload, user?.role])
  if (!['helper', 'admin'].includes(user?.role)) return <Navigate to="/" />
  const addRotation = async () => {
    setError('')
    setNotice('')
    try {
      const payload = rotationPayload(form)
      const result =
        tab === 0
          ? await casualFridayApi.fromCatalogue({ ...payload, canonicalGameId: game.id })
          : tab === 1
            ? await casualFridayApi.fromIgdb({ ...payload, igdbUrl })
            : await casualFridayApi.manual({ ...payload, title: form.displayTitle })
      setNotice(
        `${result.rotation.displayTitle} joined the rotation. ${itadMessage(result.rotation)}`
      )
      setGame(null)
      setForm(blank)
      setIgdbUrl('')
      await reload()
    } catch (err) {
      setError(requestMessage(err))
    }
  }
  const saveRotation = async () => {
    setError('')
    setNotice('')
    try {
      const result = await casualFridayApi.update(edit.id, rotationPayload(edit))
      setEdit(null)
      setNotice(`${result.rotation.displayTitle} was updated.`)
      await reload()
    } catch (err) {
      setError(requestMessage(err))
    }
  }
  const cancelPlaylist = async () => {
    setError('')
    setNotice('')
    try {
      const result = await casualFridayApi.cancel(
        playlistRef.current.id,
        playlistRef.current.version,
        cancellationReason
      )
      replacePlaylist(result.playlist)
      setCancelling(false)
      setCancellationReason('')
      setNotice('This week’s Casual Friday event was cancelled.')
    } catch (err) {
      setError(requestMessage(err))
    }
  }
  const restorePlaylist = async () => {
    setError('')
    setNotice('')
    try {
      const result = await casualFridayApi.restore(
        playlistRef.current.id,
        playlistRef.current.version
      )
      replacePlaylist(result.playlist)
      setNotice('The cancelled playlist was restored as a draft.')
    } catch (err) {
      setError(requestMessage(err))
      await reload()
    }
  }
  const active = rotation.filter((item) => item.status === 'active')
  const removeEntry = async (entry) => {
    setError('')
    try {
      const result = await casualFridayApi.removeFromPlaylist(
        playlistRef.current.id,
        entry.id,
        playlistRef.current.version
      )
      replacePlaylist(result.playlist)
      setNotice(`${entry.rotation.displayTitle || entry.game.title} was removed from the draft.`)
    } catch (err) {
      setError(requestMessage(err))
      await reload()
    }
  }
  const openKeyOffer = (entry) => {
    setKeyOfferEntry(entry)
    setKeyOfferForm({ price: entry.keyOffer?.price ?? '', url: entry.keyOffer?.url || '' })
    setError('')
  }
  const saveKeyOffer = async () => {
    setSavingKeyOffer(true)
    setError('')
    try {
      const current = playlistRef.current
      const result = await casualFridayApi.setKeyOffer(
        current.id,
        keyOfferEntry.id,
        current.version,
        Number(keyOfferForm.price),
        keyOfferForm.url
      )
      replacePlaylist(result.playlist)
      setKeyOfferEntry(null)
      setNotice(
        `Key offer saved for ${keyOfferEntry.rotation.displayTitle || keyOfferEntry.game.title}.`
      )
    } catch (err) {
      setError(requestMessage(err))
      await reload()
    } finally {
      setSavingKeyOffer(false)
    }
  }
  const removeKeyOffer = async () => {
    if (!window.confirm('Remove this key offer?')) return
    setSavingKeyOffer(true)
    setError('')
    try {
      const current = playlistRef.current
      const result = await casualFridayApi.removeKeyOffer(
        current.id,
        keyOfferEntry.id,
        current.version
      )
      replacePlaylist(result.playlist)
      setKeyOfferEntry(null)
      setNotice('Key offer removed.')
    } catch (err) {
      setError(requestMessage(err))
      await reload()
    } finally {
      setSavingKeyOffer(false)
    }
  }
  const persistOrder = async (entries) => {
    const current = playlistRef.current
    if (!current?.editable) return
    const ordered = withPositions(entries)
    replacePlaylist({ ...current, entries: ordered })
    setSavingOrder(true)
    setError('')
    try {
      const result = await casualFridayApi.reorderPlaylist(
        current.id,
        ordered.map((entry) => entry.id),
        current.version
      )
      replacePlaylist(result.playlist)
      setNotice('Playlist order saved.')
    } catch (err) {
      setError(requestMessage(err))
      await reload()
    } finally {
      setSavingOrder(false)
    }
  }
  const moveEntry = (from, to) => {
    if (to < 0 || to >= playlistRef.current.entries.length || savingOrder) return
    const entries = [...playlistRef.current.entries]
    const [entry] = entries.splice(from, 1)
    entries.splice(to, 0, entry)
    persistOrder(entries)
  }
  const dragStart = (event, entryId) => {
    dragCommittedRef.current = false
    dragStartEntriesRef.current = playlistRef.current.entries
    setDragging(entryId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', entryId)
  }
  const dragOver = (event, targetId) => {
    event.preventDefault()
    if (!dragging || dragging === targetId) return
    const entries = [...playlistRef.current.entries]
    const from = entries.findIndex((entry) => entry.id === dragging)
    const to = entries.findIndex((entry) => entry.id === targetId)
    if (from < 0 || to < 0) return
    const [entry] = entries.splice(from, 1)
    entries.splice(to, 0, entry)
    replacePlaylist({ ...playlistRef.current, entries: withPositions(entries) })
  }
  const drop = (event) => {
    event.preventDefault()
    dragCommittedRef.current = true
    const entries = playlistRef.current.entries
    setDragging(null)
    persistOrder(entries)
  }
  const dragEnd = () => {
    if (!dragCommittedRef.current && dragStartEntriesRef.current.length)
      replacePlaylist({ ...playlistRef.current, entries: dragStartEntriesRef.current })
    setDragging(null)
  }
  const fields = (
    value,
    setter,
    { manual = value === edit || (value === form && tab === 2) } = {}
  ) => (
    <Stack className="casual-friday-form" spacing={2}>
      {manual && (
        <>
          <TextField
            fullWidth
            label="Display title"
            value={value.displayTitle}
            onChange={(e) => setter({ ...value, displayTitle: e.target.value })}
          />
          <TextField
            fullWidth
            label="Artwork URL"
            value={value.artworkOverride}
            onChange={(e) => setter({ ...value, artworkOverride: e.target.value })}
          />
        </>
      )}
      <TextField
        fullWidth
        label="Info for players"
        multiline
        minRows={3}
        value={value.info}
        onChange={(e) => setter({ ...value, info: e.target.value })}
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          fullWidth
          type="number"
          label="Min players"
          value={value.playerCountMin}
          onChange={(e) => setter({ ...value, playerCountMin: e.target.value })}
        />
        <TextField
          fullWidth
          type="number"
          label="Max players"
          value={value.playerCountMax}
          onChange={(e) => setter({ ...value, playerCountMax: e.target.value })}
        />
        <TextField
          fullWidth
          select
          label="Play mode"
          value={value.hostMode}
          onChange={(e) => setter({ ...value, hostMode: e.target.value })}
        >
          <MenuItem value="none">Client</MenuItem>
          <MenuItem value="host_runs">Remote Play</MenuItem>
          <MenuItem value="streamable">Streaming</MenuItem>
        </TextField>
      </Stack>
      <TextField
        fullWidth
        select
        label="How players get it"
        value={value.acquisitionKind}
        onChange={(e) => setter({ ...value, acquisitionKind: e.target.value })}
      >
        <MenuItem value="owned_store">Owned store game</MenuItem>
        <MenuItem value="external_store">External store</MenuItem>
        <MenuItem value="free">Free download</MenuItem>
        <MenuItem value="web">Web game</MenuItem>
      </TextField>
      {value.acquisitionKind !== 'owned_store' && (
        <TextField
          fullWidth
          label="Download / play link"
          value={value.acquisitionUrl}
          onChange={(e) => setter({ ...value, acquisitionUrl: e.target.value })}
        />
      )}
    </Stack>
  )

  return (
    <Stack spacing={{ xs: 2.5, md: 3.5 }}>
      <Stack spacing={1}>
        <Typography variant="h2">Casual Friday Tools</Typography>
        <Typography color="text.secondary">
          Verify access before Friday; timing is announced on Discord.
        </Typography>
      </Stack>
      {notice && <Alert severity="success">{notice}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
      <Card>
        <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>
            Rotation pool
          </Typography>
          <Tabs
            className="casual-friday-tabs"
            value={tab}
            onChange={(_, value) => setTab(value)}
            variant="scrollable"
            scrollButtons={false}
            sx={{ mb: 2.5 }}
          >
            <Tab label="From Catalogue" />
            <Tab label="From IGDB" />
            <Tab label="Manual / External" />
          </Tabs>
          <Stack className="casual-friday-form" spacing={2.5}>
            {tab === 0 && (
              <>
                <CatalogueGameSearch
                  label="Find a catalogue game"
                  onSelect={(selected) => {
                    setGame(selected)
                    setForm((value) => ({ ...value, displayTitle: selected.title }))
                  }}
                  loadGames={gameLoader}
                />
                {game && (
                  <Chip
                    sx={{ width: 'fit-content', maxWidth: '100%' }}
                    label={`Selected: ${game.title}`}
                    onDelete={() => setGame(null)}
                  />
                )}
              </>
            )}
            {tab === 1 && (
              <TextField
                fullWidth
                label="IGDB game URL"
                value={igdbUrl}
                onChange={(e) => setIgdbUrl(e.target.value)}
              />
            )}
            {fields(form, setForm)}
            <Button
              sx={{ alignSelf: 'flex-start' }}
              variant="contained"
              disabled={(tab === 0 && !game) || (tab === 1 && !igdbUrl)}
              onClick={addRotation}
            >
              Add to rotation
            </Button>
          </Stack>
          <Divider sx={{ my: { xs: 3, md: 4 } }} />
          {active.length === 0 && (
            <Typography color="text.secondary">No active games in the rotation yet.</Typography>
          )}
          {active.map((item) => {
            const title = item.displayTitle || item.game?.title || 'Untitled game'
            const info = item.info || 'No player information supplied.'
            return (
              <Stack
                key={item.id}
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{ py: 2, minWidth: 0, borderBottom: 1, borderColor: 'divider' }}
              >
                <Box
                  component="img"
                  src={item.artwork || '/placeholder-game.jpg'}
                  alt=""
                  sx={{
                    width: { xs: 64, sm: 96 },
                    height: { xs: 88, sm: 128 },
                    flexShrink: 0,
                    alignSelf: 'flex-start',
                    objectFit: 'cover',
                    borderRadius: 1
                  }}
                />
                <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                  <Typography
                    variant="h6"
                    color="primary"
                    title={title}
                    sx={{
                      overflow: 'hidden',
                      overflowWrap: 'anywhere',
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 2
                    }}
                  >
                    {title}
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={0.75}>
                    <Chip
                      size="small"
                      icon={<Groups2RoundedIcon />}
                      label={
                        item.playerCountLabel ||
                        `${item.playerCountMin}–${item.playerCountMax} players`
                      }
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      icon={<SportsEsportsRoundedIcon />}
                      label={modeLabel(item.hostMode)}
                    />
                    {['free', 'web'].includes(item.acquisitionKind) && (
                      <Chip size="small" color="success" label="Free" />
                    )}
                    <OfferChip offer={item.itad.status === 'verified' ? item.itad.offer : null} />
                  </Stack>
                  <Typography
                    color="text.secondary"
                    title={info}
                    sx={{
                      overflow: 'hidden',
                      overflowWrap: 'anywhere',
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 1
                    }}
                  >
                    {info}
                  </Typography>
                  {item.acquisitionUrl && (
                    <Button
                      component="a"
                      href={item.acquisitionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="small"
                      sx={{ width: 'fit-content' }}
                    >
                      Get / play game
                    </Button>
                  )}
                  {!['verified', 'not_required'].includes(item.itad.status) && (
                    <Chip
                      size="small"
                      sx={{ width: 'fit-content' }}
                      color={item.itad.status === 'pending' ? 'default' : 'warning'}
                      label={itadMessage(item)}
                    />
                  )}
                  {item.itad.offerError && (
                    <Alert severity="warning" sx={{ py: 0 }}>
                      Price lookup failed: {item.itad.offerError}
                    </Alert>
                  )}
                  <Stack direction="row" flexWrap="wrap" gap={1}>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={playlist && !playlist.editable}
                      onClick={() =>
                        casualFridayApi
                          .addToPlaylist(item.id)
                          .then(({ playlist: value }) => {
                            replacePlaylist(value)
                            reload()
                          })
                          .catch((e) => setError(e.message))
                      }
                    >
                      Add to Playlist
                    </Button>
                    <Button size="small" onClick={() => setEdit(item)}>
                      Edit
                    </Button>
                    <Button
                      size="small"
                      onClick={() => casualFridayApi.recheck(item.id).then(reload)}
                    >
                      Retry ITAD
                    </Button>
                    <Button
                      size="small"
                      color="warning"
                      onClick={() =>
                        window.confirm(`Retire ${title}?`) &&
                        casualFridayApi
                          .retire(item.id, 'Retired')
                          .then(reload)
                          .catch((e) => setError(e.message))
                      }
                    >
                      Retire
                    </Button>
                  </Stack>
                </Stack>
              </Stack>
            )
          })}
        </CardContent>
      </Card>
      <Card sx={{ overflow: 'hidden' }}>
        <Box
          sx={{
            position: 'relative',
            p: { xs: 2, sm: 3 },
            pr: { xs: 11, sm: 14 },
            minHeight: { xs: 120, sm: 'auto' },
            bgcolor: 'rgba(127,255,212,.045)',
            borderBottom: 1,
            borderColor: 'divider'
          }}
        >
          <Chip
            color="primary"
            label={`${playlist?.entries?.length || 0} selected`}
            sx={{
              position: 'absolute',
              top: { xs: 16, sm: 24 },
              right: { xs: 16, sm: 24 },
              fontWeight: 800
            }}
          />
          <Stack spacing={0.4}>
            <Typography variant="overline" color="primary">
              Next event lineup
            </Typography>
            <Typography variant="h5">Weekly playlist</Typography>
            <Typography color="text.secondary">
              This preview contains the same game and acquisition details members will receive.
            </Typography>
            <Chip
              size="small"
              color={
                playlist?.status === 'published'
                  ? 'success'
                  : playlist?.status === 'cancelled'
                    ? 'error'
                    : 'primary'
              }
              variant="outlined"
              label={
                playlist?.status === 'published'
                  ? 'Published · editable until Saturday 06:00'
                  : playlist?.status === 'cancelled'
                    ? 'Cancelled'
                    : 'Draft'
              }
              sx={{ width: 'fit-content', mt: '8px !important' }}
            />
          </Stack>
        </Box>
        <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}>
          {!playlist?.entries?.length && (
            <Box
              sx={{
                py: 4,
                textAlign: 'center',
                border: '1px dashed',
                borderColor: 'divider',
                borderRadius: 2
              }}
            >
              <Typography variant="h6">Your draft is empty</Typography>
              <Typography color="text.secondary">Choose a game from the rotation above.</Typography>
            </Box>
          )}
          <Stack spacing={1.5}>
            {playlist?.entries?.map((entry, index) => (
              <PlaylistEntryCard
                key={entry.id}
                entry={entry}
                index={index}
                count={playlist.entries.length}
                editable={playlist.editable}
                dragging={dragging}
                saving={savingOrder || savingKeyOffer}
                onDragStart={dragStart}
                onDragOver={dragOver}
                onDrop={drop}
                onDragEnd={dragEnd}
                onMove={moveEntry}
                onRemove={removeEntry}
                onInfo={setInfoEntry}
                onKeyOffer={openKeyOffer}
              />
            ))}
          </Stack>
          {playlist && (
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              alignItems={{ sm: 'center' }}
              gap={1.5}
              sx={{ mt: 2.5 }}
            >
              <Typography variant="body2" color="text.secondary">
                {playlist.status === 'cancelled'
                  ? `Cancelled${playlist.cancellationReason ? `: ${playlist.cancellationReason}` : '.'}`
                  : !playlist.editable
                    ? 'This event is complete and its lineup is locked.'
                    : savingOrder
                      ? 'Saving the new order…'
                      : playlist.entries.length
                        ? 'Drag cards or use the arrow controls to change the order.'
                        : 'Add at least one game to publish.'}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                {playlist.status === 'cancelled' && (
                  <Button
                    variant="outlined"
                    onClick={() =>
                      window.confirm('Restore this cancelled playlist as an editable draft?') &&
                      restorePlaylist()
                    }
                  >
                    Restore as draft
                  </Button>
                )}
                {playlist.status === 'published' && (
                  <Button color="error" variant="outlined" onClick={() => setCancelling(true)}>
                    Cancel event
                  </Button>
                )}
                {playlist.status === 'draft' && (
                  <Button
                    variant="contained"
                    disabled={!playlist.entries.length || savingOrder}
                    onClick={() =>
                      window.confirm(
                        `Publish this ${playlist.entries.length}-game Casual Friday playlist? It will remain editable until Saturday at 06:00 Europe/Rome.`
                      ) &&
                      casualFridayApi
                        .confirm(playlist.id, playlist.version)
                        .then(({ playlist: value }) => {
                          replacePlaylist(value)
                          setNotice(
                            'The Casual Friday playlist is now published and remains editable until Saturday at 06:00.'
                          )
                        })
                        .catch((err) => setError(requestMessage(err)))
                    }
                  >
                    Publish playlist
                  </Button>
                )}
              </Stack>
            </Stack>
          )}
        </CardContent>
      </Card>
      <Dialog open={Boolean(edit)} onClose={() => setEdit(null)} fullWidth>
        <DialogTitle>Edit rotation game</DialogTitle>
        <DialogContent sx={{ pt: '12px !important' }}>
          {edit && fields(edit, setEdit)}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEdit(null)}>Cancel</Button>
          <Button variant="contained" onClick={saveRotation}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(infoEntry)} onClose={() => setInfoEntry(null)} fullWidth maxWidth="sm">
        <DialogTitle>{infoEntry?.rotation.displayTitle || infoEntry?.game.title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography sx={{ whiteSpace: 'pre-line' }}>
              {infoEntry?.rotation.info ||
                infoEntry?.game.summary ||
                'No player information supplied.'}
            </Typography>
            {infoEntry?.rotation.joinInstructions && (
              <Typography>
                <Box component="span" fontWeight={800}>
                  How to join:{' '}
                </Box>
                {infoEntry.rotation.joinInstructions}
              </Typography>
            )}
            {infoEntry?.rotation.availabilityNote && (
              <Alert severity="info">{infoEntry.rotation.availabilityNote}</Alert>
            )}
            <Typography variant="body2" color="text.secondary">
              ITAD: {infoEntry?.itad?.status || 'unknown'}
              {infoEntry?.itad?.title ? ` · ${infoEntry.itad.title}` : ''}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInfoEntry(null)}>Close</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(keyOfferEntry)}
        onClose={() => !savingKeyOffer && setKeyOfferEntry(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{keyOfferEntry?.keyOffer ? 'Edit' : 'Add'} key offer</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography color="text.secondary">
              Add a manually checked key-market offer for{' '}
              {keyOfferEntry?.rotation.displayTitle || keyOfferEntry?.game.title}. Members will see
              it beside the official-store price.
            </Typography>
            <TextField
              autoFocus
              required
              type="number"
              label="Price (EUR)"
              value={keyOfferForm.price}
              onChange={(event) => setKeyOfferForm({ ...keyOfferForm, price: event.target.value })}
              slotProps={{ htmlInput: { min: 0.01, max: 10000, step: 0.01 } }}
            />
            <TextField
              required
              type="url"
              label="Offer link"
              value={keyOfferForm.url}
              onChange={(event) => setKeyOfferForm({ ...keyOfferForm, url: event.target.value })}
              helperText="Use the HTTPS page where members can check or buy the key."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          {keyOfferEntry?.keyOffer && (
            <Button color="error" disabled={savingKeyOffer} onClick={removeKeyOffer}>
              Remove offer
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button disabled={savingKeyOffer} onClick={() => setKeyOfferEntry(null)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingKeyOffer || !keyOfferForm.price || !keyOfferForm.url.trim()}
            onClick={saveKeyOffer}
          >
            Save offer
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={cancelling} onClose={() => setCancelling(false)} fullWidth maxWidth="sm">
        <DialogTitle>Cancel this week’s event?</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="warning">
              Members will no longer see this playlist. A helper or admin can restore it as a draft
              and publish it again before the event deadline.
            </Alert>
            <TextField
              autoFocus
              required
              multiline
              minRows={2}
              label="Cancellation reason"
              value={cancellationReason}
              onChange={(event) => setCancellationReason(event.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelling(false)}>Keep event</Button>
          <Button
            color="error"
            variant="contained"
            disabled={!cancellationReason.trim()}
            onClick={cancelPlaylist}
          >
            Cancel event
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
