import { Link } from 'react-router'
import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material'
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import { catalogueOwnerText } from './catalogueCopy'

export default function CatalogueGameCard({ game }) {
  const extras = (values, maximum = 2) => values?.slice(0, maximum) || []

  return (
    <Card
      component={Link}
      to={`/catalogue/${game.id}`}
      className="catalogue-game-card catalogue-game-card--link"
    >
      <Box
        className={`catalogue-cover${game.artwork ? ' catalogue-cover--artwork' : ''}`}
        sx={game.artwork ? { backgroundImage: `url("${game.artwork}")` } : undefined}
      >
        <Box className="catalogue-rating">
          <StarRoundedIcon fontSize="small" />
          {Number.isFinite(game.rating) ? Math.round(game.rating) : '—'}
        </Box>
      </Box>
      <CardContent className="catalogue-game-card__content">
        <Typography className="game-title-clamp" variant="h6">
          {game.title}
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 1 }}>
          {extras(game.genres).map((value) => (
            <Chip key={value} size="small" label={value} />
          ))}
          {game.genres?.length > 2 && <Chip size="small" label={`+${game.genres.length - 2}`} />}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, minHeight: 40 }}>
          {extras(game.platforms, 3).join(' · ') || 'Piattaforme in arrivo da er cosmo'}
        </Typography>
        <Box className="catalogue-ownership">
          <PeopleAltOutlinedIcon color="primary" fontSize="small" />
          <Typography variant="body2" color="primary">
            {catalogueOwnerText(game.ownerCount)}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  )
}
