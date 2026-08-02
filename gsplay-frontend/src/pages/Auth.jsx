import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import ErrorNotice from '../components/ErrorNotice'
import { useAuth } from '../context/useAuth'

export default function Auth({ signup = false }) {
  const { user, login, signup: register } = useAuth()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')

  if (user) return <Navigate to="/" />

  const submit = async (event) => {
    event.preventDefault()
    if (signup && form.password.length < 8) {
      setError('Aò, so’ almeno 8 caratteri: le istruzioni stavano là, mica je serveva er notaio.')
      return
    }
    try {
      await (signup ? register : login)(form)
    } catch {
      setError('Aò, credenziali sbagliate o server imbalsamato.')
    }
  }

  return (
    <Container maxWidth="sm" sx={{ pt: 12 }}>
      <Card>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h2">{signup ? 'Fatti riconosce' : 'Rieccote'}</Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            I giochi tuoi, er gruppo tuo, i paesi suoi.
          </Typography>
          <Box component="form" onSubmit={submit}>
            <Stack spacing={2}>
              <ErrorNotice value={error} />
              <TextField
                required
                label="Nome utente"
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
              />
              <TextField
                required
                type="password"
                label="Password"
                helperText="Almeno 8 caratteri, nun barà"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
              <Button type="submit" variant="contained" size="large">
                {signup ? 'Crea account' : 'Entra'}
              </Button>
              <Button component={Link} to={signup ? '/login' : '/signup'}>
                {signup ? 'Ce l’hai già? Entra' : 'Sei nuovo? Fatti un account'}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Container>
  )
}
