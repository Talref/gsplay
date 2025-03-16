import React, { useState, useEffect } from 'react';
import { Box, Button, Typography, useTheme, Snackbar, Alert, List, ListItem, ListItemText } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import Navbar from './Navbar';
import Footer from './Footer';
import { refreshGames, setSteamId, fetchGames } from '../services/api';

const YourLibrary = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('info');
  const [games, setGames] = useState([]);

  // Fetch the user's game list on component mount
  useEffect(() => {
    const loadGames = async () => {
      try {
        const gamesData = await fetchGames();
        setGames(gamesData);
      } catch (error) {
        setSnackbarMessage('Error fetching game list.');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        console.error('Error fetching games:', error);
      }
    };

    if (user) {
      loadGames();
    }
  }, [user]);

  const handleRefreshGames = async () => {
    try {
      await refreshGames();
      setSnackbarMessage('Games refreshed successfully!');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);

      // Refetch the game list after refreshing
      const gamesData = await fetchGames();
      setGames(gamesData);
    } catch (error) {
      setSnackbarMessage('Error fetching games. Did you link your SteamID?');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      console.error('Error refreshing games:', error);
    }
  };

  const handleSetSteamId = async () => {
    const steamId = prompt('Please enter your SteamID:');
    if (steamId) {
      try {
        await setSteamId(steamId);
        setSnackbarMessage('SteamID set successfully!');
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
      } catch (error) {
        setSnackbarMessage('Error setting SteamID. Please try again.');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        console.error('Error setting SteamID:', error);
      }
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  // Function to handle clicking on a game
  const handleGameClick = (steamId) => {
    const steamUrl = `https://store.steampowered.com/app/${steamId}`;
    window.open(steamUrl, '_blank'); // Open the Steam page in a new tab
  };

  return (
    <Box sx={theme.components.MuiBox.styleOverrides.root}>
      {/* Navbar at the top */}
      <Navbar />

      {/* Main content */}
      <Box sx={{ padding: 4 }}>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Your Library
        </Typography>

        <Box>
          {/* Refresh Library button */}
          <Button variant="default" sx={{ mr: 2 }} onClick={handleRefreshGames}>
            Refresh Library
          </Button>

          {/* Add/Change SteamID button */}
          <Button variant="accent" onClick={handleSetSteamId}>
            {user?.steamId ? 'Change SteamID' : 'Add SteamID'}
          </Button>
        </Box>

        {/* Display the game list */}
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Your Games
          </Typography>
          {games.length > 0 ? (
            <List>
              {games.map((game, index) => (
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
                  <ListItemText primary={game.name} /> {/* Display the game name */}
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body1">No games found. Refresh your library or add a SteamID.</Typography>
          )}
        </Box>
      </Box>

      {/* Footer */}
      <Footer />

      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default YourLibrary;