import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import RotationFields from './RotationFields'

export default function ManageDialogs({
  edit,
  onEditChange,
  onSaveEdit,
  movieEdit,
  onMovieEditChange,
  onSaveMovieEdit,
  savingMovie,
  infoEntry,
  onCloseInfo,
  keyOfferEntry,
  keyOfferForm,
  onKeyOfferFormChange,
  savingKeyOffer,
  onCloseKeyOffer,
  onRemoveKeyOffer,
  onSaveKeyOffer,
  cancelling,
  cancellationReason,
  cancellationWarning,
  onCancellationReasonChange,
  onCloseCancellation,
  onCancelPlaylist
}) {
  return (
    <>
      <Dialog open={Boolean(edit)} onClose={() => onEditChange(null)} fullWidth>
        <DialogTitle>Edit rotation game</DialogTitle>
        <DialogContent sx={{ pt: '12px !important' }}>
          {edit && <RotationFields value={edit} onChange={onEditChange} manual />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => onEditChange(null)}>Cancel</Button>
          <Button variant="contained" onClick={onSaveEdit}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(movieEdit)}
        onClose={() => !savingMovie && onMovieEditChange(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Edit movie</DialogTitle>
        <DialogContent>
          {movieEdit && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                required
                label="Title"
                value={movieEdit.title}
                onChange={(event) => onMovieEditChange({ ...movieEdit, title: event.target.value })}
                slotProps={{ htmlInput: { maxLength: 300 } }}
              />
              <TextField
                multiline
                minRows={4}
                label="Description"
                value={movieEdit.overview}
                onChange={(event) =>
                  onMovieEditChange({ ...movieEdit, overview: event.target.value })
                }
                slotProps={{ htmlInput: { maxLength: 4000 } }}
              />
              <TextField
                type="url"
                label="Poster URL"
                value={movieEdit.posterUrl}
                onChange={(event) =>
                  onMovieEditChange({ ...movieEdit, posterUrl: event.target.value })
                }
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
                <TextField
                  fullWidth
                  type="number"
                  label="TMDB rating"
                  value={movieEdit.rating}
                  onChange={(event) =>
                    onMovieEditChange({ ...movieEdit, rating: event.target.value })
                  }
                  slotProps={{ htmlInput: { min: 0, max: 10, step: 0.1 } }}
                />
                <TextField
                  fullWidth
                  type="number"
                  label="Runtime (minutes)"
                  value={movieEdit.runtimeMinutes}
                  onChange={(event) =>
                    onMovieEditChange({ ...movieEdit, runtimeMinutes: event.target.value })
                  }
                  slotProps={{ htmlInput: { min: 1, max: 1440, step: 1 } }}
                />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                The TMDB identity and link stay fixed for this playlist entry.
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={savingMovie} onClick={() => onMovieEditChange(null)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingMovie || !movieEdit?.title.trim()}
            onClick={onSaveMovieEdit}
          >
            Save movie
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(infoEntry)} onClose={onCloseInfo} fullWidth maxWidth="sm">
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
          <Button onClick={onCloseInfo}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(keyOfferEntry)}
        onClose={() => !savingKeyOffer && onCloseKeyOffer()}
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
              onChange={(event) =>
                onKeyOfferFormChange({ ...keyOfferForm, price: event.target.value })
              }
              slotProps={{ htmlInput: { min: 0.01, max: 10000, step: 0.01 } }}
            />
            <TextField
              required
              type="url"
              label="Offer link"
              value={keyOfferForm.url}
              onChange={(event) =>
                onKeyOfferFormChange({ ...keyOfferForm, url: event.target.value })
              }
              helperText="Use the HTTPS page where members can check or buy the key."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          {keyOfferEntry?.keyOffer && (
            <Button color="error" disabled={savingKeyOffer} onClick={onRemoveKeyOffer}>
              Remove offer
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button disabled={savingKeyOffer} onClick={onCloseKeyOffer}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingKeyOffer || !keyOfferForm.price || !keyOfferForm.url.trim()}
            onClick={onSaveKeyOffer}
          >
            Save offer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={cancelling} onClose={onCloseCancellation} fullWidth maxWidth="sm">
        <DialogTitle>Cancel this week’s event?</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="warning">{cancellationWarning}</Alert>
            <TextField
              autoFocus
              required
              multiline
              minRows={2}
              label="Cancellation reason"
              value={cancellationReason}
              onChange={(event) => onCancellationReasonChange(event.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseCancellation}>Keep event</Button>
          <Button
            color="error"
            variant="contained"
            disabled={!cancellationReason.trim()}
            onClick={onCancelPlaylist}
          >
            Cancel event
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
