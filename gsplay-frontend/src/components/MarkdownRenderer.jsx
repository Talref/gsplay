import { Box } from '@mui/material'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'

const sanitizationPlugins = [rehypeSanitize]

export default function MarkdownRenderer({ markdown }) {
  return (
    <Box className="guide-markdown">
      <ReactMarkdown rehypePlugins={sanitizationPlugins}>{markdown}</ReactMarkdown>
    </Box>
  )
}
