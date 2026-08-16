import { useState } from 'react'
import { Link } from 'react-router'
import { Box, Button, Card, CardContent, Chip, Collapse, Stack, Typography } from '@mui/material'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded'
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined'

const wishlistLabel = (count) =>
  count === 1 ? '1 compare lo vuole' : `${count} compari lo vogliono`
const ownerLabel = (count) => (count === 1 ? '1 già ce l’ha' : `${count} già ce l’hanno`)

function MemberList({ title, members, empty }) {
  return (
    <Stack spacing={0.75}>
      <Typography className="pixel-label" variant="body2" color="primary">
        {title}
      </Typography>
      {members.length ? (
        <Stack direction="row" flexWrap="wrap" gap={0.75}>
          {members.map((member) => (
            <Chip key={member.id} size="small" label={member.username} />
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {empty}
        </Typography>
      )}
    </Stack>
  )
}

export default function MostWantedCard({ game }) {
  const [expanded, setExpanded] = useState(false)
  const detailsId = `most-wanted-details-${game.id}`
  return (
    <Card
      component="article"
      className={`game-card game-card--interactive${game.artwork ? ' game-card--cover' : ''}`}
      sx={game.artwork ? { backgroundImage: `url(${JSON.stringify(game.artwork)})` } : undefined}
    >
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <Typography color="primary" variant="h5" sx={{ minWidth: 42 }}>
              #{game.rank}
            </Typography>
            <Typography
              component={Link}
              to={`/catalogue/${game.id}`}
              variant="h6"
              className="game-title-clamp"
              sx={{ flexGrow: 1, color: 'inherit', textDecoration: 'none', minHeight: 0 }}
            >
              {game.title}
            </Typography>
          </Stack>
          <Stack direction="row" flexWrap="wrap" gap={0.75}>
            <Chip
              size="small"
              color="primary"
              icon={<FavoriteBorderRoundedIcon />}
              label={wishlistLabel(game.wishlistCount)}
            />
            <Chip
              size="small"
              variant="outlined"
              icon={<PeopleAltOutlinedIcon />}
              label={ownerLabel(game.ownerCount)}
            />
          </Stack>
          <Box>
            <Button
              size="small"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              aria-controls={detailsId}
              endIcon={
                <ExpandMoreRoundedIcon
                  sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '160ms' }}
                />
              }
            >
              {expanded ? 'Nascondi i compari' : 'Vedi i compari'}
            </Button>
          </Box>
          <Collapse in={expanded}>
            <Stack id={detailsId} spacing={1.5} sx={{ pt: 0.5 }}>
              <MemberList
                title="LO VOGLIONO"
                members={game.wishlistedBy}
                empty="Qua nun dovrebbe esse vuoto, se semo persi un voto."
              />
              <MemberList
                title="CE L’HANNO GIÀ"
                members={game.ownedBy}
                empty="Ancora nessuno: er portafoglio trema compatto."
              />
            </Stack>
          </Collapse>
        </Stack>
      </CardContent>
    </Card>
  )
}
