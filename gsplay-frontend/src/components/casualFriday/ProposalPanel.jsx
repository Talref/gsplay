import { useState } from 'react'
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography
} from '@mui/material'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import Groups2RoundedIcon from '@mui/icons-material/Groups2Rounded'

function Proposal({ proposal, canReject, onAccept, onReject }) {
  return (
    <Stack
      component="article"
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{ py: 2, minWidth: 0, borderTop: 1, borderColor: 'divider' }}
    >
      <Box
        component="img"
        src={proposal.game.artwork || '/placeholder-game.jpg'}
        alt=""
        sx={{
          width: { xs: 64, sm: 84 },
          height: { xs: 88, sm: 112 },
          flexShrink: 0,
          objectFit: 'cover',
          borderRadius: 1
        }}
      />
      <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="h6" sx={{ overflowWrap: 'anywhere' }}>
          {proposal.game.title}
        </Typography>
        {proposal.game.summary && (
          <Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {proposal.game.summary}
          </Typography>
        )}
        <Stack direction="row" flexWrap="wrap" gap={0.75} alignItems="center">
          <Chip
            size="small"
            color="primary"
            variant="outlined"
            icon={<Groups2RoundedIcon />}
            label={`${proposal.proposerCount} interested`}
          />
          {proposal.proposers.map((proposer) => (
            <Chip
              key={proposer.id}
              size="small"
              avatar={<Avatar>{proposer.username.slice(0, 1).toUpperCase()}</Avatar>}
              label={proposer.username}
            />
          ))}
        </Stack>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          <Button size="small" variant="contained" onClick={() => onAccept(proposal)}>
            Review and accept
          </Button>
          {canReject && (
            <Button size="small" color="warning" onClick={() => onReject(proposal)}>
              Reject
            </Button>
          )}
        </Stack>
      </Stack>
    </Stack>
  )
}

export default function ProposalPanel({ proposals, canReject, onAccept, onReject }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
          <Box>
            <Stack direction="row" alignItems="center" gap={1}>
              <Typography variant="h6">Community proposals</Typography>
              <Chip
                size="small"
                color={proposals.length ? 'primary' : 'default'}
                label={proposals.length}
              />
            </Stack>
            <Typography color="text.secondary" variant="body2">
              Games members would like to see in the rotation.
            </Typography>
          </Box>
          <Tooltip title={expanded ? 'Collapse proposals' : 'Expand proposals'}>
            <IconButton
              aria-label={expanded ? 'Collapse proposals' : 'Expand proposals'}
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
            >
              <ExpandMoreRoundedIcon
                sx={{
                  transform: expanded ? 'rotate(180deg)' : 'none',
                  transition: 'transform 150ms'
                }}
              />
            </IconButton>
          </Tooltip>
        </Stack>
        <Collapse in={expanded}>
          <Divider sx={{ mt: 2 }} />
          {!proposals.length ? (
            <Typography color="text.secondary" sx={{ pt: 2 }}>
              No pending community proposals.
            </Typography>
          ) : (
            proposals.map((proposal) => (
              <Proposal
                key={proposal.id}
                proposal={proposal}
                canReject={canReject}
                onAccept={onAccept}
                onReject={onReject}
              />
            ))
          )}
        </Collapse>
      </CardContent>
    </Card>
  )
}
