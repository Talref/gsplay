// src/components/SearchSuggestions.jsx
import React from 'react';
import {
  Box,
  Paper,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  Skeleton,
  Chip
} from '@mui/material';
import { People as PeopleIcon } from '@mui/icons-material';

const SearchSuggestions = ({
  suggestions,
  loading,
  selectedIndex,
  isVisible,
  onSelect,
  anchorEl
}) => {
  if (!isVisible && !loading) return null;

  // Get position relative to input
  const getPosition = () => {
    if (!anchorEl) return {};

    const rect = anchorEl.getBoundingClientRect();
    return {
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 1300
    };
  };

  return (
    <Paper
      elevation={8}
      sx={{
        ...getPosition(),
        maxHeight: 300,
        overflow: 'auto',
        borderRadius: 2
      }}
    >
      {loading ? (
        // Loading skeleton
        <List sx={{ py: 0 }}>
          {[1, 2, 3].map((index) => (
            <ListItem key={index} sx={{ py: 1.5 }}>
              <ListItemAvatar>
                <Skeleton variant="circular" width={40} height={40} />
              </ListItemAvatar>
              <ListItemText
                primary={<Skeleton variant="text" width="60%" />}
                secondary={<Skeleton variant="text" width="40%" />}
              />
            </ListItem>
          ))}
        </List>
      ) : suggestions.length > 0 ? (
        <List sx={{ py: 0 }}>
          {suggestions.map((game, index) => (
            <ListItem
              key={game._id}
              onClick={() => onSelect(game)}
              sx={{
                py: 1.5,
                cursor: 'pointer',
                backgroundColor: selectedIndex === index ? 'action.selected' : 'transparent',
                '&:hover': {
                  backgroundColor: 'action.hover'
                }
              }}
            >
              <ListItemAvatar>
                <Avatar
                  variant="rounded"
                  src={game.artwork || '/placeholder-game.jpg'}
                  alt={game.name}
                  sx={{ width: 40, height: 40 }}
                />
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {game.name}
                  </Typography>
                }
                secondary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    {game.genres && game.genres.length > 0 && (
                      <Chip
                        label={game.genres[0]}
                        size="small"
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <PeopleIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        {game.ownerCount || 0}
                      </Typography>
                    </Box>
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      ) : (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Nessun gioco trovato
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default SearchSuggestions;
