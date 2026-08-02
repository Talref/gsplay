import { MenuItem, Stack, TextField } from '@mui/material'

export default function RotationFields({ value, onChange, manual = false }) {
  const change = (field) => (event) => onChange({ ...value, [field]: event.target.value })

  return (
    <Stack className="casual-friday-form" spacing={2}>
      {manual && (
        <>
          <TextField
            fullWidth
            label="Display title"
            value={value.displayTitle}
            onChange={change('displayTitle')}
          />
          <TextField
            fullWidth
            label="Artwork URL"
            value={value.artworkOverride}
            onChange={change('artworkOverride')}
          />
        </>
      )}
      <TextField
        fullWidth
        label="Info for players"
        multiline
        minRows={3}
        value={value.info}
        onChange={change('info')}
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          fullWidth
          type="number"
          label="Min players"
          value={value.playerCountMin}
          onChange={change('playerCountMin')}
        />
        <TextField
          fullWidth
          type="number"
          label="Max players"
          value={value.playerCountMax}
          onChange={change('playerCountMax')}
        />
        <TextField
          fullWidth
          select
          label="Play mode"
          value={value.hostMode}
          onChange={change('hostMode')}
        >
          <MenuItem value="none">Client</MenuItem>
          <MenuItem value="host_runs">Remote Play</MenuItem>
          <MenuItem value="streamable">Streaming</MenuItem>
        </TextField>
      </Stack>
      <TextField
        fullWidth
        select
        label="How players get it"
        value={value.acquisitionKind}
        onChange={change('acquisitionKind')}
      >
        <MenuItem value="owned_store">Owned store game</MenuItem>
        <MenuItem value="external_store">External store</MenuItem>
        <MenuItem value="free">Free download</MenuItem>
        <MenuItem value="web">Web game</MenuItem>
      </TextField>
      {value.acquisitionKind !== 'owned_store' && (
        <TextField
          fullWidth
          label="Download / play link"
          value={value.acquisitionUrl}
          onChange={change('acquisitionUrl')}
        />
      )}
    </Stack>
  )
}
