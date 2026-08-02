import { Stack, TextField } from '@mui/material'

export default function MetadataFields({ value, onChange }) {
  const change = (field) => (event) => onChange({ ...value, [field]: event.target.value })

  return (
    <Stack spacing={1.5} sx={{ mt: 2, mb: 2 }}>
      <TextField
        required
        fullWidth
        label="Game title"
        value={value.title}
        onChange={change('title')}
      />
      <TextField
        fullWidth
        multiline
        minRows={2}
        label="Summary"
        value={value.summary}
        onChange={change('summary')}
      />
      <TextField fullWidth label="Artwork URL" value={value.artwork} onChange={change('artwork')} />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <TextField
          fullWidth
          label="Genres (comma-separated)"
          value={value.genres}
          onChange={change('genres')}
        />
        <TextField
          fullWidth
          label="Platforms (comma-separated)"
          value={value.platforms}
          onChange={change('platforms')}
        />
        <TextField
          type="date"
          fullWidth
          label="Release date"
          slotProps={{ inputLabel: { shrink: true } }}
          value={value.releaseDate}
          onChange={change('releaseDate')}
        />
      </Stack>
    </Stack>
  )
}
