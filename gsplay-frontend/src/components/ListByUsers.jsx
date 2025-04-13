//components/ListByUsers.jsx
import React, { useState, useEffect } from 'react';
import { Box, Typography, useTheme, List, ListItem, ListItemText, Checkbox, Button, Grid } from '@mui/material';
import Navbar from './Navbar';
import Footer from './Footer';
import { fetchAllGames } from '../services/api';

const ListByUsers = () => {
  const theme = useTheme();
  const [games, setGames] = useState([]); // State to store all games
  const [users, setUsers] = useState([]); // State to store all users
  const [selectedUsers, setSelectedUsers] = useState([]); // State to store selected users
  const [commonGames, setCommonGames] = useState([]); // State to store common games

  // Fetch all games and users on component mount
  useEffect(() => {
    const loadGames = async () => {
      try {
        const gamesData = await fetchAllGames();
        setGames(gamesData);

        // Extract and sort all unique users
        const allUsers = [...new Set(gamesData.flatMap((game) => game.users))].sort((a, b) =>
          a.toLowerCase().localeCompare(b.toLowerCase())
        );
        setUsers(allUsers);
      } catch (error) {
        console.error('Error fetching games:', error);
      }
    };

    loadGames();
  }, []);

  // Handle selecting/deselecting a user
  const handleUserSelect = (user) => {
    setSelectedUsers((prev) =>
      prev.includes(user)
        ? prev.filter((u) => u !== user) // Deselect user
        : [...prev, user] // Select user
    );
  };

  // Handle button click to filter common games
  const handleFilterClick = () => {
    if (selectedUsers.length === 0) {
      setCommonGames([]); // If no users are selected, show an empty list
      return;
    }

    const filteredGames = games
      .filter((game) => selectedUsers.every((user) => game.users.includes(user))) // Filter games
      .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically by game name

    setCommonGames(filteredGames);
  };

  // Handle clicking on a game to open the Steam page
  const handleGameClick = (steamId) => {
    const steamUrl = `https://store.steampowered.com/app/${steamId}`;
    window.open(steamUrl, '_blank'); // Open the Steam page in a new tab
  };

  return (
    <Box sx={theme.components.MuiBox.styleOverrides.root}>
      {/* Navbar at the top */}
      <Navbar />

      {/* Main content */}
      <Box component="main" sx={{ flexGrow: 1, padding: 4 }}>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Filtra Per Utenti
        </Typography>

        <Grid container spacing={10}>
          {/* Left Column: User List */}
          <Grid item xs={2}>
            <Button variant="accent" onClick={handleFilterClick} sx={{ mt: 2 }}>
              Lista per Utenti Selezionati
            </Button>
            <List>
              {users.map((user, index) => (
                <ListItem key={index}>
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

          {/* Right Column: Common Games List */}
          <Grid item xs={8}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Giochi Comuni
            </Typography>
            {commonGames.length > 0 ? (
              <List>
                {commonGames.map((game, index) => (
                  <ListItem
                    key={index}
                    onClick={() => handleGameClick(game.steamId)} // Make the list item clickable
                    sx={{
                      cursor: 'pointer', // Change cursor to pointer on hover
                      '&:hover': {
                        backgroundColor: theme.palette.primary.light, // Highlight on hover
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

      {/* Footer */}
      <Footer />
    </Box>
  );
};

export default ListByUsers;