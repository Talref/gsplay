import { Box, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material'
import PlaylistEntryCard from './PlaylistEntryCard'

function playlistStatus(playlist) {
  if (playlist?.status === 'published')
    return { color: 'success', label: 'Published · editable until Saturday 06:00' }
  if (playlist?.status === 'cancelled') return { color: 'error', label: 'Cancelled' }
  return { color: 'primary', label: 'Draft' }
}

export default function PlaylistPanel({
  playlist,
  dragging,
  savingOrder,
  savingKeyOffer,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMove,
  onRemove,
  onInfo,
  onKeyOffer,
  onRestore,
  onCancel,
  onPublish
}) {
  const status = playlistStatus(playlist)

  return (
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
            color={status.color}
            variant="outlined"
            label={status.label}
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
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
              onMove={onMove}
              onRemove={onRemove}
              onInfo={onInfo}
              onKeyOffer={onKeyOffer}
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
                <Button variant="outlined" onClick={onRestore}>
                  Restore as draft
                </Button>
              )}
              {playlist.status === 'published' && (
                <Button color="error" variant="outlined" onClick={onCancel}>
                  Cancel event
                </Button>
              )}
              {playlist.status === 'draft' && (
                <Button
                  variant="contained"
                  disabled={!playlist.entries.length || savingOrder}
                  onClick={onPublish}
                >
                  Publish playlist
                </Button>
              )}
            </Stack>
          </Stack>
        )}
      </CardContent>
    </Card>
  )
}
