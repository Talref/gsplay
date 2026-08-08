import { useEffect, useState } from 'react'
import { Navigate } from 'react-router'
import {
  Alert,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography
} from '@mui/material'
import ErrorNotice from '../components/ErrorNotice'
import MarkdownRenderer from '../components/MarkdownRenderer'
import { useAuth } from '../context/useAuth'
import { useLoad } from '../hooks/useLoad'
import { useUnsavedChangesWarning } from '../hooks/useUnsavedChangesWarning'
import { guideApi } from '../services/api'

export default function AdminGuide() {
  const { user } = useAuth()
  const guide = useLoad(guideApi.get, [])
  const [markdown, setMarkdown] = useState('')
  const [savedMarkdown, setSavedMarkdown] = useState('')
  const [updatedAt, setUpdatedAt] = useState(null)
  const [mode, setMode] = useState('edit')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const dirty = markdown !== savedMarkdown

  useUnsavedChangesWarning(dirty)

  useEffect(() => {
    if (!guide.data) return
    setMarkdown(guide.data.guide.markdown)
    setSavedMarkdown(guide.data.guide.markdown)
    setUpdatedAt(guide.data.guide.updatedAt)
  }, [guide.data])

  if (user?.role !== 'admin') return <Navigate to="/" />

  const save = async () => {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const response = await guideApi.update(markdown)
      setSavedMarkdown(response.guide.markdown)
      setUpdatedAt(response.guide.updatedAt)
      setNotice('Guide saved.')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 980, mx: 'auto' }}>
      <Typography variant="h2">Guide editor</Typography>
      {notice && <Alert severity="success">{notice}</Alert>}
      <ErrorNotice value={error || guide.error} />
      {guide.loading ? (
        <CircularProgress aria-label="Loading guide editor" />
      ) : (
        <Card>
          <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
            <Stack spacing={2.5}>
              <Tabs value={mode} onChange={(_event, value) => setMode(value)}>
                <Tab value="edit" label="Edit" />
                <Tab value="preview" label="Preview" />
              </Tabs>
              {mode === 'edit' ? (
                <TextField
                  label="Guide Markdown"
                  value={markdown}
                  onChange={(event) => setMarkdown(event.target.value)}
                  multiline
                  minRows={18}
                  slotProps={{ htmlInput: { maxLength: 100_000 } }}
                  helperText={`${markdown.length.toLocaleString('it-IT')} / 100.000 characters`}
                />
              ) : markdown ? (
                <MarkdownRenderer markdown={markdown} />
              ) : (
                <Alert severity="info">The guide is empty.</Alert>
              )}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
                <Button variant="contained" onClick={save} disabled={!dirty || saving}>
                  {saving ? 'Saving…' : 'Save guide'}
                </Button>
                {updatedAt && (
                  <Typography color="text.secondary" variant="body2" sx={{ pt: { sm: 1 } }}>
                    Last saved {new Date(updatedAt).toLocaleString('it-IT')}
                  </Typography>
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  )
}
