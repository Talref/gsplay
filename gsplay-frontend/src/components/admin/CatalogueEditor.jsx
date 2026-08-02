import { Button, Card, CardContent, Divider, Stack, TextField, Typography } from '@mui/material'
import CatalogueGameSearch from '../CatalogueGameSearch'
import MetadataFields from './MetadataFields'

export default function CatalogueEditor({
  loadGames,
  selected,
  onSelect,
  igdbUrl,
  onIgdbUrlChange,
  onAttachIgdb,
  onRefreshMetadata,
  draft,
  onDraftChange,
  onSave,
  onHide,
  onUnhide,
  identities,
  selectedIdentity,
  onIdentitySelect,
  mergeTarget,
  onMergeTargetSelect,
  reason,
  onReasonChange,
  onReassign,
  onMerge,
  onArchive
}) {
  const selectedId = selected?.id
  const targetId = mergeTarget?.id

  return (
    <Card>
      <CardContent>
        <Typography variant="h6">Find and correct a catalogue game</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, mb: 2 }}>
          Searches active and hidden catalogue records on the server. Preview appears after three
          characters.
        </Typography>
        <CatalogueGameSearch label="Search catalogue" onSelect={onSelect} loadGames={loadGames} />
        {selected && (
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Typography color="text.secondary">
              Editing: {selected.title} · Status: {selected.metadataStatus}
              {selected.hidden ? ' · Hidden' : ''}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                fullWidth
                label="Correct IGDB game URL"
                placeholder="https://www.igdb.com/games/correct-game"
                value={igdbUrl}
                onChange={(event) => onIgdbUrlChange(event.target.value)}
                helperText="Pulls verified IGDB metadata into this record. Ownership is unchanged."
              />
              <Button variant="outlined" disabled={!igdbUrl.trim()} onClick={onAttachIgdb}>
                Pull verified metadata
              </Button>
            </Stack>
            <Button variant="outlined" onClick={onRefreshMetadata}>
              Refresh this game from IGDB
            </Button>
            <Typography variant="caption" color="text.secondary">
              Queues a background refresh for this one game. It keeps ownership unchanged and uses
              its verified IGDB ID when available.
            </Typography>
            <MetadataFields value={draft} onChange={onDraftChange} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button variant="contained" onClick={onSave}>
                Save changes
              </Button>
              {selected.hidden ? (
                <Button color="success" variant="outlined" onClick={onUnhide}>
                  Unhide
                </Button>
              ) : (
                <Button color="warning" variant="outlined" onClick={() => onHide(selectedId)}>
                  Hide from Catalogue
                </Button>
              )}
            </Stack>

            <Divider />
            <Typography variant="h6">Repair a collapsed provider game</Typography>
            <Typography color="text.secondary">
              Choose the exact provider ID to move. Every current owner moves to the target, and
              future syncs follow the correction.
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {identities.map((identity) => (
                <Button
                  key={`${identity.provider}:${identity.providerGameId}`}
                  variant={
                    selectedIdentity?.provider === identity.provider &&
                    selectedIdentity?.providerGameId === identity.providerGameId
                      ? 'contained'
                      : 'outlined'
                  }
                  onClick={() => onIdentitySelect(identity)}
                >
                  {identity.provider} · {identity.providerGameId} ·{' '}
                  {identity.providerTitles.join(' / ')} · {identity.affectedUserCount} owners
                </Button>
              ))}
            </Stack>
            {selectedIdentity && (
              <>
                <CatalogueGameSearch
                  label="Search correct destination game"
                  excludeId={selectedId}
                  onSelect={onMergeTargetSelect}
                  loadGames={loadGames}
                />
                {mergeTarget && (
                  <Typography color="text.secondary">
                    Move {selectedIdentity.provider} {selectedIdentity.providerGameId} to:{' '}
                    {mergeTarget.title}
                  </Typography>
                )}
                <TextField
                  required
                  label="Repair reason"
                  value={reason}
                  onChange={(event) => onReasonChange(event.target.value)}
                  helperText="This writes a durable audit record."
                />
                <Button
                  color="warning"
                  variant="contained"
                  disabled={!targetId || !reason.trim()}
                  onClick={onReassign}
                >
                  Move this provider game for every owner
                </Button>
              </>
            )}

            <Divider />
            <CatalogueGameSearch
              label="Search surviving game to merge into"
              excludeId={selectedId}
              onSelect={onMergeTargetSelect}
              loadGames={loadGames}
            />
            {mergeTarget && (
              <Typography color="text.secondary">Merge target: {mergeTarget.title}</Typography>
            )}
            <TextField
              label="Merge/archive reason"
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button variant="outlined" disabled={!targetId} onClick={onMerge}>
                Merge into survivor
              </Button>
              <Button color="error" variant="outlined" onClick={onArchive}>
                Archive unreferenced game
              </Button>
            </Stack>
          </Stack>
        )}
      </CardContent>
    </Card>
  )
}
