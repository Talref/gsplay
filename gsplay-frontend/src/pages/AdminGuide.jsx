import { useEffect, useRef, useState } from 'react'
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
  const [uploadingImage, setUploadingImage] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const editorRef = useRef(null)
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

  const uploadImage = async (file) => {
    if (!file || uploadingImage) return
    const start = editorRef.current?.selectionStart ?? markdown.length
    const end = editorRef.current?.selectionEnd ?? start
    setUploadingImage(true)
    setError('')
    setNotice('')
    try {
      const response = await guideApi.uploadImage(file)
      const alt =
        file.name
          .replace(/\.[^.]+$/, '')
          .replace(/[[\]\n\r]/g, ' ')
          .trim() || 'image'
      const leadingNewline = start > 0 && markdown[start - 1] !== '\n' ? '\n' : ''
      const trailingNewline = end < markdown.length && markdown[end] !== '\n' ? '\n' : ''
      const inserted = `${leadingNewline}![${alt}](${response.url})${trailingNewline}`
      setMarkdown(`${markdown.slice(0, start)}${inserted}${markdown.slice(end)}`)
      setNotice('Image uploaded and inserted.')
      requestAnimationFrame(() => {
        const cursor = start + inserted.length
        editorRef.current?.focus()
        editorRef.current?.setSelectionRange(cursor, cursor)
      })
    } catch (uploadError) {
      setError(uploadError.message)
    } finally {
      setUploadingImage(false)
    }
  }

  const handlePaste = (event) => {
    const item = [...event.clipboardData.items].find((candidate) => candidate.kind === 'file')
    const file = item?.getAsFile()
    if (!file) return
    event.preventDefault()
    uploadImage(file)
  }

  const handleDrop = (event) => {
    const file = event.dataTransfer.files[0]
    if (!file) return
    event.preventDefault()
    uploadImage(file)
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
                  inputRef={editorRef}
                  value={markdown}
                  onChange={(event) => setMarkdown(event.target.value)}
                  onPaste={handlePaste}
                  onDragOver={(event) => {
                    if (event.dataTransfer.types.includes('Files')) event.preventDefault()
                  }}
                  onDrop={handleDrop}
                  disabled={uploadingImage}
                  multiline
                  minRows={18}
                  slotProps={{ htmlInput: { maxLength: 100_000 } }}
                  helperText={`${markdown.length.toLocaleString('it-IT')} / 100.000 characters · Paste or drop JPEG, PNG, GIF, or WebP images`}
                />
              ) : markdown ? (
                <MarkdownRenderer markdown={markdown} />
              ) : (
                <Alert severity="info">The guide is empty.</Alert>
              )}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
                <Button
                  variant="contained"
                  onClick={save}
                  disabled={!dirty || saving || uploadingImage}
                >
                  {saving ? 'Saving…' : 'Save guide'}
                </Button>
                {uploadingImage && (
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ pt: { sm: 0.75 } }}>
                    <CircularProgress size={20} aria-label="Uploading guide image" />
                    <Typography variant="body2">Uploading image…</Typography>
                  </Stack>
                )}
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
