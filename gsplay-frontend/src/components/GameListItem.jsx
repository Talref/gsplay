import React from 'react';
import { ListItem, ListItemText, Typography, useTheme } from '@mui/material';

const GameListItem = ({ game, onClick }) => {
  const theme = useTheme();

  return (
    <ListItem
      sx={{
        cursor: 'pointer',
        '&:hover': {
          backgroundColor: theme.palette.primary.light,
        },
      }}
      onClick={() => onClick(game)}
    >
      <ListItemText
        primary={game.name}
        primaryTypographyProps={{
          color: theme.palette.text.primary,
          fontWeight: '500',
        }}
      />
      <Typography
        variant="body1"
        sx={{
          color: theme.palette.text.secondary,
          marginLeft: 'auto',
        }}
      >
        Posseduto da: {game.users.length}
      </Typography>
    </ListItem>
  );
};

export default GameListItem;
