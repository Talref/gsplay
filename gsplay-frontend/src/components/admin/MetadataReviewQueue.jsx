import {
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import MetadataFields from './MetadataFields'

export default function MetadataReviewQueue({
  reviews,
  reviewUrls,
  onReviewUrlChange,
  onChooseCandidate,
  onResolveUrl,
  manualReviewId,
  manualReview,
  onToggleManual,
  onManualReviewChange,
  onResolveManual,
  onHide,
  loading,
  hasMore,
  sentinelRef
}) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6">IGDB ambiguity review</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Every failed, visible catalogue record. Resolve one at a time; only the three strongest
          suggestions are shown.
        </Typography>
        <Divider sx={{ my: 1 }} />
        {reviews.map((review) => (
          <Stack
            key={review.game.id}
            spacing={1.5}
            sx={{ py: 2, borderBottom: 1, borderColor: 'divider' }}
          >
            <Typography variant="h6">{review.game.title}</Typography>
            <Typography color="text.secondary">{review.error}</Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {review.candidates.map((candidate) => (
                <Button
                  key={candidate.igdbId}
                  variant="outlined"
                  onClick={() => onChooseCandidate(review.game.id, candidate.igdbId)}
                >
                  Use {candidate.title}
                </Button>
              ))}
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                fullWidth
                label="IGDB game URL"
                placeholder="https://www.igdb.com/games/example"
                value={reviewUrls[review.game.id] || ''}
                onChange={(event) => onReviewUrlChange(review.game.id, event.target.value)}
              />
              <Button
                variant="outlined"
                disabled={!reviewUrls[review.game.id]?.trim()}
                onClick={() => onResolveUrl(review.game.id)}
              >
                Enrich with IGDB Link
              </Button>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button variant="outlined" onClick={() => onToggleManual(review)}>
                Enrich manually
              </Button>
              <Button color="warning" variant="outlined" onClick={() => onHide(review.game.id)}>
                Hide from Catalogue
              </Button>
            </Stack>
            {manualReviewId === review.game.id && (
              <>
                <MetadataFields value={manualReview} onChange={onManualReviewChange} />
                <Button
                  variant="contained"
                  disabled={!manualReview.title.trim()}
                  onClick={() => onResolveManual(review.game.id)}
                >
                  Save manual metadata
                </Button>
              </>
            )}
          </Stack>
        ))}
        {loading && <CircularProgress aria-label="Loading failed games" />}
        {hasMore && <div ref={sentinelRef} aria-label="Load more failed games" />}
        {!loading && !reviews.length && (
          <Typography color="text.secondary">No failed visible games await review.</Typography>
        )}
      </CardContent>
    </Card>
  )
}
