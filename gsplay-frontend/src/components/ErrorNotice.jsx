import { Alert } from '@mui/material'

export default function ErrorNotice({ value }) {
  return value ? <Alert severity="error">{value}</Alert> : null
}
