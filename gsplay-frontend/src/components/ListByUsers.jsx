import React, { useState, useEffect } from 'react';
import { Box, Typography, useTheme, List, ListItem, ListItemText, Checkbox, Button, Grid } from '@mui/material';
import Navbar from './Navbar';
import Footer from './Footer';
import { fetchAllGames } from '../services/api';
import { gameTitleFormatter } from '../utils/formatters';

// IGBD linking
const gameUrlFormatter = (game) => {
  if (!game || !game.name) {
    return null;
  }
  return `https://www.igdb.com/games/${gameTitleFormatter(game.name)}`;
};

const ListByUsers = () => {
  const theme = useTheme();
  const [games, setGames] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [commonGames, setCommonGames] = useState([]);

  // Fetches games and populates the users state on component mount.
  useEffect(() => {
    const loadGames = async () => {
      try {
        const gamesData = await fetchAllGames();
        setGames(gamesData);

        const allUsers = [...new Set(gamesData.flatMap((game) => game.users.map(u => u.user)))].sort((a, b) =>
          a.toLowerCase().localeCompare(b.toLowerCase())
        );
        setUsers(allUsers);
      } catch (error) {
        console.error('Error fetching games:', error);
      }
    };
    loadGames();
  }, []);

  // Handles checking/unchecking a user from the list.
  const handleUserSelect = (user) => {
    setSelectedUsers((prev) =>
      prev.includes(user)
        ? prev.filter((u) => u !== user)
        : [...prev, user]
    );
  };

  // Filters the games to find those owned by ALL selected users.
  const handleFilterClick = () => {
    if (selectedUsers.length === 0) {
      setCommonGames([]);
      return;
    }

    const filteredGames = games
      .filter((game) => selectedUsers.every((user) => game.users.some(u => u.user === user))) 
      .sort((a, b) => a.name.localeCompare(b.name));

    setCommonGames(filteredGames);
  };

  // Opens the game's page in a new tab using the new URL formatter.
  const handleGameClick = (game) => {
    const url = gameUrlFormatter(game);
    if (url) {
      window.open(url, '_blank');
    } else {
      console.error('No valid URL could be generated for this game.');
    }
  };

  return (
    <Box sx={theme.components.MuiBox.styleOverrides.root}>
      <Navbar />

      <Box component="main" sx={{ flexGrow: 1, padding: 4 }}>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Filtra Per Utenti
        </Typography>

        <Grid container spacing={10}>
          <Grid item xs={2}>
            <Button variant="accent" onClick={handleFilterClick} sx={{ mt: 2 }}>
              Lista per Utenti Selezionati
            </Button>
            <List>
              {users.map((user) => (
                <ListItem key={user}>
                  <Checkbox
                    checked={selectedUsers.includes(user)}
                    onChange={() => handleUserSelect(user)}
                    sx={{ color: theme.palette.secondary.main }}
                  />
                  <ListItemText primary={user} />
                </ListItem>
              ))}
            </List>
          </Grid>

          <Grid item xs={8}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Giochi in comune con gli utenti selezionati
            </Typography>
            {commonGames.length > 0 ? (
              <List>
                {commonGames.map((game) => (
                  <ListItem
                    key={game.name}
                    onClick={() => handleGameClick(game)} // Pass the full game object
                    sx={{
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: theme.palette.primary.light,
                      },
                    }}
                  >
                    <ListItemText
                      primary={game.name}
                      primaryTypographyProps={{
                        color: theme.palette.text.primary,
                        fontWeight: '500',
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body1">Nessun gioco in comune trovato.</Typography>
            )}
          </Grid>
        </Grid>
      </Box>

      <Footer />
    </Box>
  );
};

export default ListByUsers;