import Groups2RoundedIcon from '@mui/icons-material/Groups2Rounded'
import SportsEsportsRoundedIcon from '@mui/icons-material/SportsEsportsRounded'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography
} from '@mui/material'
import CatalogueGameSearch from '../CatalogueGameSearch'
import { OfferChip } from './OfferChips'
import RotationFields from './RotationFields'

const itadMessage = (item) => {
  const messages = {
    verified: 'ITAD verified',
    not_required: 'ITAD not required',
    ambiguous:
      'ITAD found multiple possible matches. Recheck after the backend matching flow is configured.',
    not_found: 'ITAD could not find this title',
    pending: 'ITAD verification pending'
  }

  if (item.itad.status === 'error') {
    return `ITAD verification unavailable${item.itad.error ? `: ${item.itad.error}` : '.'}`
  }
  return messages[item.itad.status] || messages.pending
}

const modeLabel = (mode) =>
  mode === 'host_runs' ? 'Remote Play' : mode === 'streamable' ? 'Streaming' : 'Client'

function RotationGame({ item, playlistEditable, onAddToPlaylist, onEdit, onRecheck, onRetire }) {
  const title = item.displayTitle || item.game?.title || 'Untitled game'
  const info = item.info || 'No player information supplied.'

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{ py: 2, minWidth: 0, borderBottom: 1, borderColor: 'divider' }}
    >
      <Box
        component="img"
        src={item.artwork || '/placeholder-game.jpg'}
        alt=""
        sx={{
          width: { xs: 64, sm: 96 },
          height: { xs: 88, sm: 128 },
          flexShrink: 0,
          alignSelf: 'flex-start',
          objectFit: 'cover',
          borderRadius: 1
        }}
      />
      <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <Typography
          variant="h6"
          color="primary"
          title={title}
          sx={{
            overflow: 'hidden',
            overflowWrap: 'anywhere',
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2
          }}
        >
          {title}
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={0.75}>
          <Chip
            size="small"
            icon={<Groups2RoundedIcon />}
            label={item.playerCountLabel || `${item.playerCountMin}–${item.playerCountMax} players`}
          />
          <Chip
            size="small"
            variant="outlined"
            icon={<SportsEsportsRoundedIcon />}
            label={modeLabel(item.hostMode)}
          />
          {['free', 'web'].includes(item.acquisitionKind) && (
            <Chip size="small" color="success" label="Free" />
          )}
          <OfferChip offer={item.itad.status === 'verified' ? item.itad.offer : null} />
        </Stack>
        <Typography
          color="text.secondary"
          title={info}
          sx={{
            overflow: 'hidden',
            overflowWrap: 'anywhere',
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 1
          }}
        >
          {info}
        </Typography>
        {item.acquisitionUrl && (
          <Button
            component="a"
            href={item.acquisitionUrl}
            target="_blank"
            rel="noopener noreferrer"
            size="small"
            sx={{ width: 'fit-content' }}
          >
            Get / play game
          </Button>
        )}
        {!['verified', 'not_required'].includes(item.itad.status) && (
          <Chip
            size="small"
            sx={{ width: 'fit-content' }}
            color={item.itad.status === 'pending' ? 'default' : 'warning'}
            label={itadMessage(item)}
          />
        )}
        {item.itad.offerError && (
          <Alert severity="warning" sx={{ py: 0 }}>
            Price lookup failed: {item.itad.offerError}
          </Alert>
        )}
        <Stack direction="row" flexWrap="wrap" gap={1}>
          <Button
            size="small"
            variant="contained"
            disabled={!playlistEditable}
            onClick={() => onAddToPlaylist(item)}
          >
            Add to Playlist
          </Button>
          <Button size="small" onClick={() => onEdit(item)}>
            Edit
          </Button>
          <Button size="small" onClick={() => onRecheck(item)}>
            Retry ITAD
          </Button>
          <Button size="small" color="warning" onClick={() => onRetire(item, title)}>
            Retire
          </Button>
        </Stack>
      </Stack>
    </Stack>
  )
}

export default function RotationPool({
  tab,
  onTabChange,
  game,
  onGameSelect,
  onClearGame,
  loadGames,
  igdbUrl,
  onIgdbUrlChange,
  form,
  onFormChange,
  onAdd,
  active,
  playlistEditable,
  onAddToPlaylist,
  onEdit,
  onRecheck,
  onRetire
}) {
  return (
    <Card id="rotation-pool">
      <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}>
        <Typography variant="h6" sx={{ mb: 1.5 }}>
          Rotation pool
        </Typography>
        <Tabs
          className="casual-friday-tabs"
          value={tab}
          onChange={(_, value) => onTabChange(value)}
          variant="scrollable"
          scrollButtons={false}
          sx={{ mb: 2.5 }}
        >
          <Tab label="From Catalogue" />
          <Tab label="From IGDB" />
          <Tab label="Manual / External" />
        </Tabs>
        <Stack className="casual-friday-form" spacing={2.5}>
          {tab === 0 && (
            <>
              <CatalogueGameSearch
                label="Find a catalogue game"
                onSelect={onGameSelect}
                loadGames={loadGames}
              />
              {game && (
                <Chip
                  sx={{ width: 'fit-content', maxWidth: '100%' }}
                  label={`Selected: ${game.title}`}
                  onDelete={onClearGame}
                />
              )}
            </>
          )}
          {tab === 1 && (
            <TextField
              fullWidth
              label="IGDB game URL"
              value={igdbUrl}
              onChange={(event) => onIgdbUrlChange(event.target.value)}
            />
          )}
          <RotationFields value={form} onChange={onFormChange} manual={tab === 2} />
          <Button
            sx={{ alignSelf: 'flex-start' }}
            variant="contained"
            disabled={(tab === 0 && !game) || (tab === 1 && !igdbUrl)}
            onClick={onAdd}
          >
            Add to rotation
          </Button>
        </Stack>
        <Divider sx={{ my: { xs: 3, md: 4 } }} />
        {!active.length && (
          <Typography color="text.secondary">No active games in the rotation yet.</Typography>
        )}
        {active.map((item) => (
          <RotationGame
            key={item.id}
            item={item}
            playlistEditable={playlistEditable}
            onAddToPlaylist={onAddToPlaylist}
            onEdit={onEdit}
            onRecheck={onRecheck}
            onRetire={onRetire}
          />
        ))}
      </CardContent>
    </Card>
  )
}
