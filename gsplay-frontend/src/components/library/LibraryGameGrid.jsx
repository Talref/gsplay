import { Button, Card, CardContent, CircularProgress, Grid, Stack, Typography } from '@mui/material'
import { Link } from 'react-router'
import ProviderIcons from '../ProviderIcons'

export default function LibraryGameGrid({ items, loading, hasMore, sentinelRef, onRemove }) {
  return (
    <>
      <Grid container spacing={2}>
        {items.map((item) => {
          const title = item.canonicalGame?.title || item.providerTitle
          const artwork = item.canonicalGame?.artwork
          const manual = item.providers.includes('manual') && item.providers.length === 1

          return (
            <Grid key={item.id} size={{ xs: 12, sm: 6, xl: 4 }}>
              <Card
                className={`game-card${artwork ? ' game-card--cover' : ''}`}
                sx={{
                  display: 'block',
                  backgroundImage: artwork ? `url(${JSON.stringify(artwork)})` : undefined
                }}
              >
                <CardContent>
                  <Stack spacing={1}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      spacing={1}
                      alignItems="flex-start"
                    >
                      <Typography
                        component={item.canonicalGame ? Link : 'span'}
                        to={item.canonicalGame ? `/catalogue/${item.canonicalGame.id}` : undefined}
                        variant="h6"
                        className="game-title-clamp"
                        sx={{ flexGrow: 1, color: 'inherit', textDecoration: 'none' }}
                      >
                        {title}
                      </Typography>
                      <ProviderIcons providers={item.providers} />
                    </Stack>
                    {manual && (
                      <Button
                        color="error"
                        size="small"
                        onClick={() => onRemove(item)}
                        sx={{ alignSelf: 'flex-start' }}
                      >
                        Rimuovi dalla libbreria
                      </Button>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          )
        })}
      </Grid>
      {loading && <CircularProgress aria-label="Caricamento giochi" />}
      {hasMore && <div ref={sentinelRef} aria-label="Carica altri giochi" />}
      {!loading && !items.length && (
        <Typography color="text.secondary">
          Qua c’è più vuoto de Trastevere alle sette. Collegati Steam o importa un file.
        </Typography>
      )}
    </>
  )
}
