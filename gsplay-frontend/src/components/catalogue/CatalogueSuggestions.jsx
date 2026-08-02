import { Link } from 'react-router'
import { Box, Button, Paper, Typography } from '@mui/material'
import { catalogueOwnerText } from './catalogueCopy'

export default function CatalogueSuggestions({ games, onSelect }) {
  if (!games.length) return null

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'absolute',
        zIndex: 4,
        top: { xs: 58, md: 58 },
        left: 0,
        width: { xs: '100%', md: 'calc(100% - 190px)' },
        p: 0.75
      }}
    >
      <Typography className="pixel-label" color="primary" sx={{ px: 1, pt: 0.5 }}>
        5 DRITTE, POI DECIDI TU
      </Typography>
      {games.map((game) => (
        <Button
          key={game.id}
          component={Link}
          to={`/catalogue/${game.id}`}
          fullWidth
          color="inherit"
          sx={{ justifyContent: 'flex-start', gap: 1.25, py: 0.75, textAlign: 'left' }}
          onClick={onSelect}
        >
          <Box
            sx={{
              width: 30,
              height: 42,
              flexShrink: 0,
              borderRadius: 1,
              background: game.artwork
                ? `center / cover url("${game.artwork}")`
                : 'var(--gs-surface-highlight)'
            }}
          />
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography noWrap>{game.title}</Typography>
            <Typography variant="caption" color="text.secondary">
              {Number.isFinite(game.rating) ? `${Math.round(game.rating)}/100` : 'Voto disperso'} ·{' '}
              {catalogueOwnerText(game.ownerCount)}
            </Typography>
          </Box>
        </Button>
      ))}
    </Paper>
  )
}
