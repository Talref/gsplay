import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded'
import VpnKeyRoundedIcon from '@mui/icons-material/VpnKeyRounded'
import { Chip, Tooltip } from '@mui/material'

const money = (amount, currency) =>
  Number.isFinite(amount)
    ? new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'EUR' }).format(
        amount
      )
    : null

export function OfferChip({ offer }) {
  if (!offer) return null
  const price = money(offer.price, offer.currency)
  const voucher = offer.voucher ? ` · code ${offer.voucher}` : ''

  return (
    <Tooltip
      title={`Buy at ${offer.shop}${Number.isFinite(offer.discountPercent) && offer.discountPercent > 0 ? ` · ${offer.discountPercent}% off` : ''}${voucher}`}
    >
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
        label={`${price}${voucher}`}
        aria-label={`Buy at ${offer.shop} for ${price}${offer.voucher ? ` with code ${offer.voucher}` : ''}`}
      />
    </Tooltip>
  )
}

export function KeyOfferChip({ offer }) {
  if (!offer) return null
  const price = money(offer.price, offer.currency)

  return (
    <Tooltip title="Manually checked key-market offer">
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
        label={`${price} · key available`}
        aria-label={`Key available for ${price}`}
      />
    </Tooltip>
  )
}
