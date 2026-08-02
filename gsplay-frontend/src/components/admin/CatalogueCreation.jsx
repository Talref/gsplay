import { Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material'
import MetadataFields from './MetadataFields'

export default function CatalogueCreation({
  igdbUrl,
  onIgdbUrlChange,
  onImport,
  manual,
  onManualChange,
  onAddManual
}) {
  return (
    <>
      <Card>
        <CardContent>
          <Typography variant="h6">Add from IGDB link</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="IGDB game URL"
              placeholder="https://www.igdb.com/games/vintage-story"
              value={igdbUrl}
              onChange={(event) => onIgdbUrlChange(event.target.value)}
            />
            <Button variant="contained" disabled={!igdbUrl.trim()} onClick={onImport}>
              Import verified game
            </Button>
          </Stack>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6">Add manually</Typography>
          <MetadataFields value={manual} onChange={onManualChange} />
          <Button variant="outlined" disabled={!manual.title.trim()} onClick={onAddManual}>
            Add independent PC game
          </Button>
        </CardContent>
      </Card>
    </>
  )
}
