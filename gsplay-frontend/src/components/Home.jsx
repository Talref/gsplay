import React, { useState, useEffect } from 'react';
import { Box, Typography, useTheme, List, ListItem, ListItemText, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import Navbar from './Navbar';
import Footer from './Footer';
import { fetchAllGames } from '../services/api'; // Import the fetchAllGames function

const Home = () => {
  const theme = useTheme();
  const [games, setGames] = useState([]); // State to store the aggregated games list
  const [selectedGame, setSelectedGame] = useState(null); // State to store the selected game for the popup
  const [isPopupOpen, setIsPopupOpen] = useState(false); // State to control the popup visibility

  // Fetch the aggregated games list on component mount
  useEffect(() => {
    const loadGames = async () => {
      try {
        const gamesData = await fetchAllGames();
        setGames(gamesData);
      } catch (error) {
        console.error('Error fetching games:', error);
      }
    };

    loadGames();
  }, []);

  // Sort the games list
  const sortedGames = games
    .slice() // Create a copy to avoid mutating the original array
    .sort((a, b) => {
      // Sort by number of owners (descending)
      if (b.users.length !== a.users.length) {
        return b.users.length - a.users.length;
      }
      // If owners count is the same, sort alphabetically by game name
      return a.name.localeCompare(b.name);
    });

  // Handle clicking on a game
  const handleGameClick = (game) => {
    setSelectedGame(game); // Set the selected game
    setIsPopupOpen(true); // Open the popup
  };

  // Handle closing the popup
  const handleClosePopup = () => {
    setIsPopupOpen(false);
    setSelectedGame(null); // Clear the selected game
  };

  return (
    <Box sx={theme.components.MuiBox.styleOverrides.root}>
      {/* Navbar at the top */}
      <Navbar />

      {/* Main content */}
      <Box component="main" sx={{ flexGrow: 1, padding: 4 }}>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Giochi piu' popolari
        </Typography>

        {/* Display the sorted games list */}
        {sortedGames.length > 0 ? (
          <List>
            {sortedGames.map((game, index) => (
              <ListItem
                key={index}
                sx={{
                  cursor: 'pointer', // Change cursor to pointer on hover
                  '&:hover': {
                    backgroundColor: theme.palette.primary.light, // Highlight on hover
                  },
                }}
                onClick={() => handleGameClick(game)} // Handle clicking on the game
              >
                {/* Game name */}
                <ListItemText
                  primary={game.name}
                  primaryTypographyProps={{
                    color: theme.palette.text.primary,
                    fontWeight: '500',
                  }}
                />

                {/* Owned by count */}
                <Typography
                  variant="body1"
                  sx={{
                    color: theme.palette.text.secondary,
                    marginLeft: 'auto', // Push to the right
                  }}
                >
                  Posseduto da: {game.users.length}
                </Typography>
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography variant="body1">Nessun gioco trovato.</Typography>
        )}
      </Box>

      {/* Footer */}
      <Footer />

      {/* Popup for game details */}
        <Dialog
          open={isPopupOpen}
          onClose={handleClosePopup}
          PaperProps={{
            sx: { minWidth: '40%' }, // Set minWidth for the dialog content
          }}
        >
        <DialogTitle>{selectedGame?.name}</DialogTitle>
        <DialogContent>
          {/* Steam Link */}
          <Typography variant="body1" sx={{ mb: 2 }}>
            <a
              href={`https://store.steampowered.com/app/${selectedGame?.steamId}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: theme.palette.secondary.main }}
            >
              Pagina Steam
            </a>
          </Typography>

          {/* List of Owners */}
          <Typography variant="h6" sx={{ mb: 1 }}>
            Proprietari:
          </Typography>
          <List>
            {selectedGame?.users.map((user, index) => (
              <ListItem key={index}>
                <ListItemText primary={user} />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePopup}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Home;