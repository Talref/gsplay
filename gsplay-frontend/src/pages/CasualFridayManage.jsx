import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Stack, Typography } from '@mui/material'
import { Navigate } from 'react-router'
import ManageDialogs from '../components/casualFriday/ManageDialogs'
import PlaylistPanel from '../components/casualFriday/PlaylistPanel'
import ProposalPanel from '../components/casualFriday/ProposalPanel'
import RotationPool from '../components/casualFriday/RotationPool'
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

export default function CasualFridayManage() {
  const { user } = useAuth()
  const [rotation, setRotation] = useState([])
  const [proposals, setProposals] = useState([])
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
      Promise.all([
        casualFridayApi.proposals(),
        casualFridayApi.rotation(),
        casualFridayApi.playlist()
      ])
        .then(([pending, rotations, current]) => {
          setProposals(pending.proposals)
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
  const selectGame = (selected) => {
    setGame(selected)
    setForm((value) => ({ ...value, displayTitle: selected.title }))
  }
  const acceptProposal = (proposal) => {
    setTab(0)
    setGame(proposal.game)
    setForm({
      ...blank,
      displayTitle: proposal.game.title,
      info: proposal.game.summary || ''
    })
    setNotice(
      `Complete the rotation details for ${proposal.game.title}, then select Add to rotation.`
    )
    setError('')
    window.requestAnimationFrame(() =>
      document
        .getElementById('rotation-pool')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    )
  }
  const rejectProposal = async (proposal) => {
    const adminNote = window.prompt(`Why reject ${proposal.game.title}?`, '')
    if (adminNote === null) return
    setError('')
    setNotice('')
    try {
      await casualFridayApi.rejectProposal(proposal.id, adminNote)
      setNotice(`${proposal.game.title} was rejected.`)
      await reload()
    } catch (err) {
      setError(requestMessage(err))
    }
  }
  const addToPlaylist = async (item) => {
    setError('')
    try {
      const result = await casualFridayApi.addToPlaylist(item.id)
      replacePlaylist(result.playlist)
      await reload()
    } catch (err) {
      setError(requestMessage(err))
    }
  }
  const recheckRotation = async (item) => {
    setError('')
    try {
      await casualFridayApi.recheck(item.id)
      await reload()
    } catch (err) {
      setError(requestMessage(err))
    }
  }
  const retireRotation = async (item, title) => {
    if (!window.confirm(`Retire ${title}?`)) return
    setError('')
    try {
      await casualFridayApi.retire(item.id, 'Retired')
      await reload()
    } catch (err) {
      setError(requestMessage(err))
    }
  }
  const requestRestore = () => {
    if (window.confirm('Restore this cancelled playlist as an editable draft?')) restorePlaylist()
  }
  const publishPlaylist = async () => {
    const current = playlistRef.current
    if (
      !window.confirm(
        `Publish this ${current.entries.length}-game Casual Friday playlist? It will remain editable until Saturday at 06:00 Europe/Rome.`
      )
    )
      return
    setError('')
    try {
      const result = await casualFridayApi.confirm(current.id, current.version)
      replacePlaylist(result.playlist)
      setNotice(
        'The Casual Friday playlist is now published and remains editable until Saturday at 06:00.'
      )
    } catch (err) {
      setError(requestMessage(err))
    }
  }
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
      <ProposalPanel
        proposals={proposals}
        canReject={user.role === 'admin'}
        onAccept={acceptProposal}
        onReject={rejectProposal}
      />
      <RotationPool
        tab={tab}
        onTabChange={setTab}
        game={game}
        onGameSelect={selectGame}
        onClearGame={() => setGame(null)}
        loadGames={gameLoader}
        igdbUrl={igdbUrl}
        onIgdbUrlChange={setIgdbUrl}
        form={form}
        onFormChange={setForm}
        onAdd={addRotation}
        active={active}
        playlistEditable={playlist ? playlist.editable : true}
        onAddToPlaylist={addToPlaylist}
        onEdit={setEdit}
        onRecheck={recheckRotation}
        onRetire={retireRotation}
      />
      <PlaylistPanel
        playlist={playlist}
        dragging={dragging}
        savingOrder={savingOrder}
        savingKeyOffer={savingKeyOffer}
        onDragStart={dragStart}
        onDragOver={dragOver}
        onDrop={drop}
        onDragEnd={dragEnd}
        onMove={moveEntry}
        onRemove={removeEntry}
        onInfo={setInfoEntry}
        onKeyOffer={openKeyOffer}
        onRestore={requestRestore}
        onCancel={() => setCancelling(true)}
        onPublish={publishPlaylist}
      />
      <ManageDialogs
        edit={edit}
        onEditChange={setEdit}
        onSaveEdit={saveRotation}
        infoEntry={infoEntry}
        onCloseInfo={() => setInfoEntry(null)}
        keyOfferEntry={keyOfferEntry}
        keyOfferForm={keyOfferForm}
        onKeyOfferFormChange={setKeyOfferForm}
        savingKeyOffer={savingKeyOffer}
        onCloseKeyOffer={() => setKeyOfferEntry(null)}
        onRemoveKeyOffer={removeKeyOffer}
        onSaveKeyOffer={saveKeyOffer}
        cancelling={cancelling}
        cancellationReason={cancellationReason}
        onCancellationReasonChange={setCancellationReason}
        onCloseCancellation={() => setCancelling(false)}
        onCancelPlaylist={cancelPlaylist}
      />
    </Stack>
  )
}
