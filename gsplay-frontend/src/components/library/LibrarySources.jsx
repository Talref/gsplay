import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import {
  Button,
  Card,
  CardContent,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import ProviderIcons from '../ProviderIcons'

const importProviders = ['gog', 'epic', 'amazon']

export default function LibrarySources({
  user,
  steamId,
  onSteamIdChange,
  editingSteam,
  onEditSteam,
  provider,
  onProviderChange,
  file,
  onFileChange,
  onShowHelp,
  onLinkSteam,
  onSyncSteam,
  onUpload
}) {
  const steamLinked = Boolean(user?.steamAccount?.steamId)

  return (
    <Grid container spacing={2} className="equal-height-grid">
      <Grid size={{ xs: 12, lg: 6 }}>
        <Card>
          <CardContent>
            <Stack direction="row" alignItems="center">
              <Typography variant="h6">Collegamento Steam</Typography>
              <Tooltip title="Come se fa?">
                <IconButton
                  color="primary"
                  onClick={() => onShowHelp('steam')}
                  aria-label="Istruzioni SteamID"
                >
                  <InfoOutlinedIcon />
                </IconButton>
              </Tooltip>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
              {steamLinked && !editingSteam ? (
                <Typography color="primary" sx={{ flexGrow: 1, alignSelf: 'center' }}>
                  SteamID a posto, daje.
                </Typography>
              ) : (
                <TextField
                  fullWidth
                  label="Aggiungi SteamID"
                  value={steamId}
                  onChange={(event) => onSteamIdChange(event.target.value)}
                />
              )}
              <Button
                variant="outlined"
                disabled={!editingSteam && !steamId && !steamLinked}
                onClick={() => (editingSteam || !steamLinked ? onLinkSteam() : onEditSteam())}
              >
                {steamLinked && !editingSteam ? 'Cambia SteamID' : 'Salva'}
              </Button>
              <Button variant="contained" disabled={!steamLinked} onClick={onSyncSteam}>
                Daje co’ Steam
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, lg: 6 }}>
        <Card>
          <CardContent>
            <Stack direction="row" alignItems="center">
              <Typography variant="h6">Importa la libbreria</Typography>
              <Tooltip title="Che file ce vogliono?">
                <IconButton
                  color="primary"
                  onClick={() => onShowHelp('import')}
                  aria-label="Istruzioni importazione"
                >
                  <InfoOutlinedIcon />
                </IconButton>
              </Tooltip>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
              <TextField
                select
                label="Piattaforma"
                value={provider}
                onChange={(event) => onProviderChange(event.target.value)}
              >
                {importProviders.map((value) => (
                  <MenuItem key={value} value={value}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <ProviderIcons providers={[value]} /> <span>{value.toUpperCase()}</span>
                    </Stack>
                  </MenuItem>
                ))}
              </TextField>
              <Button component="label" variant="outlined" sx={{ minWidth: 180 }}>
                {file?.name || 'Scegli CSV / JSON'}
                <input
                  hidden
                  type="file"
                  accept=".csv,.json,text/csv,application/json"
                  onChange={(event) => onFileChange(event.target.files?.[0] || null)}
                />
              </Button>
              <Button variant="contained" disabled={!file} onClick={onUpload}>
                Manda in coda
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}
