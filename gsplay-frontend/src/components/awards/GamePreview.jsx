import { Box, Link, Stack, Typography } from '@mui/material'

export default function GamePreview({ game }) {
  return (
    <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0 }}>
      {game.artwork && (
        <Box
          component="img"
          src={game.artwork}
          alt=""
          sx={{ width: 54, height: 72, objectFit: 'cover', borderRadius: 1 }}
        />
      )}
      <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        <Typography fontWeight={700}>{game.title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {(game.platforms || []).join(' · ')}
        </Typography>
        {game.igdbUrl && (
          <Link
            href={game.igdbUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`IGDB: ${game.title}`}
          >
            IGDB ↗
          </Link>
        )}
      </Box>
    </Stack>
  )
}
