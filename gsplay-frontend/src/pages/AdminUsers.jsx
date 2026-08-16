import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import { Navigate } from 'react-router'
import { adminApi } from '../services/api'
import { useAuth } from '../context/useAuth'

export default function AdminUsers() {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState([])
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [reason, setReason] = useState('')
  useEffect(() => {
    if (query.trim().length < 3) {
      setUsers([])
      return undefined
    }
    let active = true
    const timer = setTimeout(
      () =>
        adminApi
          .users(query)
          .then((response) => {
            if (active) {
              setUsers(response.users)
              setError('')
            }
          })
          .catch((err) => {
            if (active) setError(err.message)
          }),
      220
    )
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [query])
  const updateRole = async (role) => {
    try {
      const response = await adminApi.setUserRole(selected.id, role)
      setSelected(response.user)
      setUsers((current) =>
        current.map((item) => (item.id === response.user.id ? response.user : item))
      )
      setNotice(`${response.user.username} is now ${role === 'helper' ? 'a Helper' : 'a member'}.`)
    } catch (err) {
      setError(err.message)
    }
  }
  const remove = async () => {
    try {
      const response = await adminApi.deleteUser(selected.id, { confirmation, reason })
      setNotice(
        `${response.deleted.username} was removed. ${response.deleted.hiddenOrphans.length} unaliased orphaned game(s) were hidden.`
      )
      setUsers((current) => current.filter((item) => item.id !== selected.id))
      setSelected(null)
      setDeleting(false)
      setConfirmation('')
      setReason('')
    } catch (err) {
      setError(err.message)
    }
  }
  if (user?.role !== 'admin') return <Navigate to="/" />
  const canDelete = selected && confirmation === `DELETE ${selected.username}` && reason.trim()
  return (
    <Stack spacing={3}>
      {notice && <Alert severity="success">{notice}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Manage users</Typography>
            <Typography color="text.secondary">
              Find members, grant trusted Helpers access for Casual Friday, or remove accounts that
              left the group.
            </Typography>
            <TextField
              label="Search a user"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              helperText="Type at least 3 characters."
              autoComplete="off"
            />
            {query.trim().length >= 3 && (
              <List dense disablePadding>
                {users.map((candidate) => (
                  <ListItemButton
                    key={candidate.id}
                    selected={selected?.id === candidate.id}
                    onClick={() => setSelected(candidate)}
                  >
                    <ListItemText
                      primary={candidate.username}
                      secondary={`${candidate.role} · joined ${new Date(candidate.createdAt).toLocaleDateString()}${candidate.hasSteamAccount ? ' · Steam linked' : ''}${candidate.hasRetroAchievements ? ' · RetroAchievements linked' : ''}`}
                    />
                  </ListItemButton>
                ))}
                {!users.length && (
                  <Typography color="text.secondary" sx={{ px: 2, py: 1 }}>
                    No matching users.
                  </Typography>
                )}
              </List>
            )}
          </Stack>
        </CardContent>
      </Card>
      {selected && (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">{selected.username}</Typography>
              <Typography color="text.secondary">Current role: {selected.role}</Typography>
              {selected.role === 'admin' ? (
                <Alert severity="info">
                  Admin accounts are protected and cannot be changed or deleted here.
                </Alert>
              ) : (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button
                    variant="contained"
                    disabled={selected.role === 'helper'}
                    onClick={() => updateRole('helper')}
                  >
                    Make Helper
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={selected.role === 'member'}
                    onClick={() => updateRole('member')}
                  >
                    Remove Helper status
                  </Button>
                  <Button color="error" variant="outlined" onClick={() => setDeleting(true)}>
                    Delete user
                  </Button>
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}
      <Dialog open={deleting} onClose={() => setDeleting(false)} fullWidth maxWidth="sm">
        <DialogTitle>Delete {selected?.username}?</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="warning">
              This deletes private account data, library entitlements, sessions, and active jobs.
              Shared catalogue records remain; eligible unaliased provider games with no owners are
              hidden.
            </Alert>
            <TextField
              autoFocus
              label={`Type DELETE ${selected?.username}`}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
            <TextField
              required
              multiline
              minRows={2}
              label="Reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(false)}>Cancel</Button>
          <Button color="error" variant="contained" disabled={!canDelete} onClick={remove}>
            Delete user
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
