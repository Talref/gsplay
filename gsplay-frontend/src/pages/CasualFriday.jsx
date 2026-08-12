import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography
} from '@mui/material'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import Groups2RoundedIcon from '@mui/icons-material/Groups2Rounded'
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import SportsEsportsRoundedIcon from '@mui/icons-material/SportsEsportsRounded'
import VpnKeyRoundedIcon from '@mui/icons-material/VpnKeyRounded'
import MemberEventPanel from '../components/casualFriday/MemberEventPanel'
import { casualFridayApi } from '../services/api'
import { useLoad } from '../hooks/useLoad'

const modeLabel = (mode) =>
  mode === 'host_runs' ? 'Remote Play' : mode === 'streamable' ? 'Streaming' : 'Client'
const money = (amount, currency) =>
  Number.isFinite(amount)
    ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: currency || 'EUR' }).format(
        amount
      )
    : null

function Access({ entry }) {
  if (entry.owned)
    return (
      <Chip
        size="small"
        color="success"
        icon={<CheckCircleOutlineRoundedIcon />}
        label="Ce l’hai"
      />
    )
  if (entry.free)
    return <Chip size="small" color="success" icon={<LocalOfferRoundedIcon />} label="Gratis" />
  const offer = entry.itad?.status === 'verified' ? entry.itad.offer : null
  const price = money(offer?.price, offer?.currency)
  if (!offer || !price) return <Chip size="small" variant="outlined" label="Da rimedià" />
  const voucher = offer.voucher ? ` · codice ${offer.voucher}` : ''
  return (
    <Chip
      component="a"
      href={offer.url}
      target="_blank"
      rel="noopener noreferrer"
      clickable
      size="small"
      color="primary"
      variant="outlined"
      icon={<LocalOfferRoundedIcon />}
      label={`${price} · ${offer.shop}${voucher}`}
      aria-label={`Compra ${entry.rotation.displayTitle || entry.game.title} su ${offer.shop} a ${price}${offer.voucher ? ` col codice ${offer.voucher}` : ''}`}
    />
  )
}

function KeyAccess({ entry }) {
  const offer = entry.keyOffer
  const price = money(offer?.price, offer?.currency)
  if (!offer || !price) return null
  return (
    <Chip
      component="a"
      href={offer.url}
      target="_blank"
      rel="noopener noreferrer"
      clickable
      size="small"
      color="secondary"
      variant="outlined"
      icon={<VpnKeyRoundedIcon />}
      label={`Chiave a ${price}`}
      aria-label={`Chiave disponibile per ${entry.rotation.displayTitle || entry.game.title} a ${price}`}
    />
  )
}

function GameCard({ entry }) {
  const rotation = entry.rotation
  const title = rotation.displayTitle || entry.game.title
  const directUrl = entry.free ? rotation.acquisitionUrl : null
  return (
    <Card component="article" sx={{ overflow: 'hidden', bgcolor: 'rgba(var(--gs-bg-rgb), .78)' }}>
      <CardContent
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '88px minmax(0,1fr)', sm: '132px minmax(0,1fr)' },
          gap: { xs: 1.5, sm: 2.5 },
          p: { xs: 1.5, sm: 2.5 },
          '&:last-child': { pb: { xs: 1.5, sm: 2.5 } }
        }}
      >
        <Box sx={{ position: 'relative' }}>
          <Box
            component="img"
            src={rotation.artwork || entry.game.artwork || '/placeholder-game.jpg'}
            alt={`Copertina di ${title}`}
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
            color="primary"
            label={`#${entry.position}`}
            sx={{ position: 'absolute', top: 6, left: 6, fontWeight: 800, boxShadow: 2 }}
          />
        </Box>
        <Stack spacing={1.25} sx={{ minWidth: 0, overflow: 'hidden' }}>
          <Typography
            variant="h5"
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
              label={
                rotation.playerCountLabel ||
                `${rotation.playerCountMin}–${rotation.playerCountMax} giocatori`
              }
            />
            <Chip
              size="small"
              variant="outlined"
              icon={<SportsEsportsRoundedIcon />}
              label={modeLabel(rotation.hostMode)}
            />
            <Access entry={entry} />
            <KeyAccess entry={entry} />
          </Stack>
          <Typography
            color="text.secondary"
            title={rotation.info || entry.game.summary || ''}
            sx={{
              whiteSpace: 'pre-line',
              overflow: 'hidden',
              overflowWrap: 'anywhere',
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 3
            }}
          >
            {rotation.info ||
              entry.game.summary ||
              'Le istruzioni stanno ancora a arrivà. Portate pazienza e un cacciavite.'}
          </Typography>
          {rotation.joinInstructions && (
            <Typography
              title={rotation.joinInstructions}
              sx={{
                overflow: 'hidden',
                overflowWrap: 'anywhere',
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 2
              }}
            >
              <Box component="span" fontWeight={800} color="primary.main">
                Come s’entra:{' '}
              </Box>
              {rotation.joinInstructions}
            </Typography>
          )}
          {rotation.availabilityNote && (
            <Alert severity="info" sx={{ py: 0 }}>
              {rotation.availabilityNote}
            </Alert>
          )}
          {directUrl && (
            <Button
              component="a"
              href={directUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="outlined"
              size="small"
              endIcon={<OpenInNewRoundedIcon />}
              sx={{ alignSelf: 'flex-start' }}
            >
              Pijalo / gioca
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}

export default function CasualFriday() {
  const current = useLoad(casualFridayApi.current, [])
  const playlist = current.data?.playlist
  const event = current.data?.event
  return (
    <Stack spacing={{ xs: 2.5, md: 3.5 }} sx={{ maxWidth: 980, mx: 'auto' }}>
      <Stack spacing={1} textAlign="center" alignItems="center">
        <Typography
          variant="h1"
          className="pixel-label"
          sx={{ color: 'primary.main', fontSize: 'clamp(1.55rem, 5vw, 3rem)' }}
        >
          CASUAL FRIDAY
        </Typography>
        <Typography color="text.secondary">
          Er venerdì serio, organizzato con la precisione d’un barbecue sotto la pioggia.
        </Typography>
      </Stack>
      {current.loading && (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <CircularProgress aria-label="Caricamento Casual Friday" />
        </Box>
      )}
      {current.error && (
        <Alert severity="error">
          Aò, la scaletta s’è incartata. Riprova tra poco, che magari se vergogna.
        </Alert>
      )}
      {!current.loading && !current.error && <MemberEventPanel initialEvent={event} />}
      {!current.loading && !current.error && !playlist && !event && (
        <Card>
          <CardContent sx={{ py: { xs: 5, sm: 8 }, textAlign: 'center' }}>
            <Typography variant="h4">Per mo’ nun se gioca.</Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Quando parte er Casual Friday, qua compare la scaletta. Nel frattempo allenate er
              pollice e non fate domande difficili.
            </Typography>
          </CardContent>
        </Card>
      )}
      {!current.loading && !current.error && !playlist && event?.status === 'cancelled' && (
        <Alert severity="warning">
          Er console ha annullato i giochi de venerdì: {event.cancellationReason || 'gli auspici erano contrari.'}
        </Alert>
      )}
      {!current.loading && !current.error && !playlist && event?.status === 'completed' && (
        <Alert severity="success">
          Er venerdì è compiuto. Le legioni so’ tornate a casa, li controller pure — più o meno.
        </Alert>
      )}
      {playlist && (
        <>
          <Stack spacing={0.5}>
            <Typography variant="h4">La scaletta de stasera</Typography>
            <Typography color="text.secondary">
              In ordine de apparizione, salvo ammutinamenti, crash e gente che deve aggiornà
              Windows.
            </Typography>
            {playlist.entries.some((entry) => entry.keyOffer) && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ maxWidth: 760, lineHeight: 1.45, fontStyle: 'italic', fontSize: '0.7rem' }}
              >
                Prima dell’acquisto di una key verifica attentamente che l’offerta sia attivabile in
                Italia, che la chiave sia per Steam e che si tratti di una chiave prodotto o di un
                regalo, non dell'acquisto di un account Steam separato.
              </Typography>
            )}
          </Stack>
          <Stack spacing={1.5}>
            {playlist.entries.map((entry) => (
              <GameCard key={entry.id} entry={entry} />
            ))}
          </Stack>
        </>
      )}
    </Stack>
  )
}
