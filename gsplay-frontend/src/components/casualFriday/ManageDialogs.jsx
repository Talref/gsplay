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
