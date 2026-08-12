import { Alert, Card, CardContent, CircularProgress, Stack, Typography } from '@mui/material'
import ErrorNotice from '../components/ErrorNotice'
import MarkdownRenderer from '../components/MarkdownRenderer'
import { useLoad } from '../hooks/useLoad'
import { guideApi } from '../services/api'

export default function Guide() {
  const guide = useLoad(guideApi.get, [])

  return (
    <Stack spacing={3} sx={{ maxWidth: 920, mx: 'auto' }}>
      <Typography variant="h1" className="pixel-label" color="primary">
        GUIDA GSPLAY
      </Typography>
      <ErrorNotice value={guide.error} />
      {guide.loading ? (
        <CircularProgress aria-label="Caricamento guida" />
      ) : (
        <Card>
          <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
            {guide.data?.guide.markdown ? (
              <MarkdownRenderer markdown={guide.data.guide.markdown} />
            ) : (
              <Alert severity="info">
                La guida ancora nun s’è fatta vede’. Ripassa tra poco e porta pazienza.
              </Alert>
            )}
            {guide.data?.guide.updatedAt && (
              <Typography color="text.secondary" variant="body2" sx={{ mt: 4 }}>
                Ultima sistemata: {new Date(guide.data.guide.updatedAt).toLocaleString('it-IT')}
              </Typography>
            )}
          </CardContent>
        </Card>
      )}
    </Stack>
  )
}
