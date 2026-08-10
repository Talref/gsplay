import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography
} from '@mui/material'
import DnsRoundedIcon from '@mui/icons-material/DnsRounded'
import Groups2RoundedIcon from '@mui/icons-material/Groups2Rounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import ErrorNotice from '../components/ErrorNotice'
import { serverStatusApi } from '../services/api'

const REFRESH_INTERVAL_MS = 30_000
const statusDisplay = {
  running: { color: 'success', label: 'Online' },
  starting: { color: 'warning', label: 'In avvio' },
  stopping: { color: 'warning', label: 'In arresto' },
  offline: { color: 'error', label: 'Fermo' },
  unknown: { color: 'default', label: 'Sconosciuto' },
  idle: { color: 'warning', label: 'Inattivo' }
}

function formatUptime(milliseconds) {
  if (milliseconds === null || milliseconds === undefined) return null
  const numericValue = Number(milliseconds)
  if (!Number.isFinite(numericValue) || numericValue < 0) return null
  const totalSeconds = Math.floor(numericValue / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
}

function groupServers(servers) {
  const groups = new Map()
  for (const server of servers) {
    if (!groups.has(server.groupId)) {
      groups.set(server.groupId, { id: server.groupId, name: server.groupName, servers: [] })
    }
    groups.get(server.groupId).servers.push(server)
  }
  return [...groups.values()]
}

function ServerCard({ server }) {
  const display = statusDisplay[server.status] || statusDisplay.unknown
  const uptime = formatUptime(server.uptimeMilliseconds)
  const hasPlayers = Number.isFinite(server.players)
  const hasMaxPlayers = Number.isFinite(server.maxPlayers)
  return (
    <Card component="article" variant="outlined" sx={{ bgcolor: 'rgba(var(--gs-bg-rgb), .62)' }}>
      <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            gap={1}
          >
            <Typography variant="h6" sx={{ overflowWrap: 'anywhere' }}>
              {server.name}
            </Typography>
            <Chip
              size="small"
              color={display.color}
              label={display.label}
              aria-label={`${server.name}: ${display.label}`}
              sx={{ fontWeight: 800 }}
            />
          </Stack>
          {(hasPlayers || uptime) && (
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {hasPlayers && (
                <Chip
                  size="small"
                  variant="outlined"
                  icon={<Groups2RoundedIcon />}
                  label={
                    hasMaxPlayers
                      ? `Giocatori: ${server.players}/${server.maxPlayers}`
                      : `Giocatori: ${server.players}`
                  }
                />
              )}
              {uptime && (
                <Chip
                  size="small"
                  variant="outlined"
                  icon={<ScheduleRoundedIcon />}
                  label={`Uptime: ${uptime}`}
                />
              )}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}

function ServerGroup({ group }) {
  return (
    <Card component="section" aria-label={group.name}>
      <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <DnsRoundedIcon color="primary" />
            <Typography variant="h5">{group.name}</Typography>
          </Stack>
          <Divider />
          <Stack spacing={1.5}>
            {group.servers.map((server, index) => (
              <ServerCard key={`${server.name}:${index}`} server={server} />
            ))}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}

export default function Servers() {
  const mounted = useRef(false)
  const [state, setState] = useState({ loading: true, refreshing: false, snapshot: null })
  const load = useCallback(async (initial = false) => {
    setState((current) => ({
      ...current,
      loading: initial && !current.snapshot,
      refreshing: !initial,
      error: null
    }))
    try {
      const result = await serverStatusApi.current()
      if (mounted.current) {
        setState({ loading: false, refreshing: false, snapshot: result.snapshot, error: null })
      }
    } catch (error) {
      if (mounted.current) {
        setState((current) => ({
          ...current,
          loading: false,
          refreshing: false,
          error: error.message
        }))
      }
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    load(true)
    const timer = window.setInterval(() => load(), REFRESH_INTERVAL_MS)
    return () => {
      mounted.current = false
      window.clearInterval(timer)
    }
  }, [load])

  const snapshot = state.snapshot
  const groups = groupServers(snapshot?.servers || [])

  return (
    <Stack spacing={3} sx={{ maxWidth: 980, mx: 'auto' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        gap={2}
      >
        <Box>
          <Typography variant="h1" className="pixel-label" color="primary">
            SERVER LIVE
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Stato dei server della community.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshRoundedIcon />}
          onClick={() => load()}
          disabled={state.loading || state.refreshing}
        >
          Aggiorna
        </Button>
      </Stack>

      <ErrorNotice value={state.error} />
      {state.loading ? (
        <CircularProgress aria-label="Caricamento stato server" />
      ) : !snapshot ? (
        <Alert severity="info">Lo stato dei server non è attualmente disponibile.</Alert>
      ) : (
        <Stack spacing={2.5}>
          {snapshot.stale && (
            <Alert severity="warning">
              Questi dati non sono aggiornati. Lo stato reale dei server potrebbe essere cambiato.
            </Alert>
          )}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            gap={1}
          >
            <Typography color="text.secondary" variant="body2">
              Ultimo aggiornamento ricevuto: {new Date(snapshot.receivedAt).toLocaleString('it-IT')}
            </Typography>
            <Chip
              size="small"
              color={snapshot.stale ? 'warning' : 'success'}
              variant="outlined"
              label={snapshot.stale ? 'Dati non aggiornati' : 'Dati aggiornati'}
            />
          </Stack>
          <Stack spacing={2}>
            {groups.map((group) => (
              <ServerGroup key={group.id} group={group} />
            ))}
          </Stack>
        </Stack>
      )}
    </Stack>
  )
}
