import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded'
import Groups2RoundedIcon from '@mui/icons-material/Groups2Rounded'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import SportsEsportsRoundedIcon from '@mui/icons-material/SportsEsportsRounded'
import VpnKeyRoundedIcon from '@mui/icons-material/VpnKeyRounded'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography
} from '@mui/material'
import { KeyOfferChip, OfferChip } from './OfferChips'

const modeLabel = (mode) =>
  mode === 'host_runs' ? 'Remote Play' : mode === 'streamable' ? 'Streaming' : 'Client'

export default function PlaylistEntryCard({
  entry,
  index,
  count,
  editable,
  dragging,
  saving,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMove,
  onRemove,
  onInfo,
  onKeyOffer
}) {
  const title = entry.rotation.displayTitle || entry.game.title
  const offer = entry.itad?.status === 'verified' ? entry.itad.offer : null
  const acquisitionUrl = entry.rotation.acquisitionUrl
  const canAcquireDirectly =
    ['free', 'web', 'external_store'].includes(entry.rotation.acquisitionKind) && acquisitionUrl

  return (
    <Card
      component="article"
      draggable={editable && !saving}
      onDragStart={(event) => onDragStart(event, entry.id)}
      onDragOver={(event) => onDragOver(event, entry.id)}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      sx={{
        opacity: dragging === entry.id ? 0.55 : 1,
        borderColor: dragging === entry.id ? 'primary.main' : 'divider',
        bgcolor: 'rgba(var(--gs-bg-rgb), .72)',
        cursor: editable ? (dragging === entry.id ? 'grabbing' : 'grab') : 'default',
        transition: 'opacity 120ms ease, border-color 120ms ease',
        '&:hover': {
          borderColor: editable ? 'rgba(var(--gs-primary-rgb), .42)' : 'divider'
        }
      }}
    >
      <CardContent
        sx={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: { xs: '88px minmax(0,1fr)', sm: '112px minmax(0,1fr) auto' },
          gap: { xs: 1.5, sm: 2.25 },
          p: { xs: 1.5, sm: 2 },
          '&:last-child': { pb: { xs: 1.5, sm: 2 } }
        }}
      >
        <Box sx={{ position: 'relative', minWidth: 0 }}>
          <Box
            component="img"
            src={entry.rotation.artwork || entry.game.artwork || '/placeholder-game.jpg'}
            alt=""
            sx={{
              display: 'block',
              width: '100%',
              aspectRatio: '3 / 4',
              objectFit: 'cover',
              borderRadius: 1.5,
              bgcolor: 'background.default'
            }}
          />
          <Chip
            size="small"
            label={`#${entry.position}`}
            color="primary"
            sx={{ position: 'absolute', left: 6, top: 6, fontWeight: 800, boxShadow: 2 }}
          />
        </Box>
        <Stack spacing={1} sx={{ minWidth: 0, overflow: 'hidden', pr: { xs: 0, sm: 1 } }}>
          <Stack direction="row" alignItems="flex-start" gap={0.5}>
            {editable && (
              <DragIndicatorRoundedIcon
                aria-hidden="true"
                sx={{
                  display: { xs: 'none', sm: 'block' },
                  flexShrink: 0,
                  color: 'text.disabled',
                  mt: 0.35,
                  ml: -0.75
                }}
              />
            )}
            <Typography
              variant="h6"
              color="primary"
              title={title}
              sx={{
                lineHeight: 1.25,
                overflow: 'hidden',
                overflowWrap: 'anywhere',
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 2
              }}
            >
              {title}
            </Typography>
          </Stack>
          <Stack direction="row" flexWrap="wrap" gap={0.75}>
            <Chip
              size="small"
              icon={<Groups2RoundedIcon />}
              label={
                entry.rotation.playerCountLabel ||
                `${entry.rotation.playerCountMin}–${entry.rotation.playerCountMax} players`
              }
            />
            <Chip
              size="small"
              variant="outlined"
              icon={<SportsEsportsRoundedIcon />}
              label={modeLabel(entry.rotation.hostMode)}
            />
            {entry.free && <Chip size="small" color="success" label="Free" />}
            <OfferChip offer={offer} />
            <KeyOfferChip offer={entry.keyOffer} />
          </Stack>
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            <Button size="small" startIcon={<InfoOutlinedIcon />} onClick={() => onInfo(entry)}>
              Player info
            </Button>
            {editable && (
              <Button
                size="small"
                startIcon={<VpnKeyRoundedIcon />}
                disabled={saving}
                onClick={() => onKeyOffer(entry)}
              >
                {entry.keyOffer ? 'Edit key offer' : 'Add key offer'}
              </Button>
            )}
          </Stack>
          {!offer && canAcquireDirectly && (
            <Button
              component="a"
              href={acquisitionUrl}
              target="_blank"
              rel="noopener noreferrer"
              size="small"
              variant="outlined"
              endIcon={<OpenInNewRoundedIcon />}
              sx={{ alignSelf: 'flex-start' }}
            >
              Get / play game
            </Button>
          )}
          {entry.itad?.offerError && (
            <Alert severity="warning" sx={{ py: 0 }}>
              Price lookup failed: {entry.itad.offerError}
            </Alert>
          )}
        </Stack>
        {editable && (
          <Stack
            direction={{ xs: 'row', sm: 'column' }}
            spacing={0.25}
            sx={{
              gridColumn: { xs: '1 / -1', sm: 'auto' },
              justifyContent: { xs: 'flex-end', sm: 'flex-start' },
              alignItems: 'center'
            }}
          >
            <Tooltip title="Move up">
              <span>
                <IconButton
                  size="small"
                  disabled={saving || index === 0}
                  aria-label={`Move ${title} up`}
                  onClick={() => onMove(index, index - 1)}
                >
                  <ArrowUpwardRoundedIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Move down">
              <span>
                <IconButton
                  size="small"
                  disabled={saving || index === count - 1}
                  aria-label={`Move ${title} down`}
                  onClick={() => onMove(index, index + 1)}
                >
                  <ArrowDownwardRoundedIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Remove from playlist">
              <span>
                <IconButton
                  size="small"
                  disabled={saving}
                  color="error"
                  aria-label={`Remove ${title} from playlist`}
                  onClick={() => onRemove(entry)}
                >
                  <DeleteOutlineRoundedIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        )}
      </CardContent>
    </Card>
  )
}
