import React, { useState, useEffect } from 'react';
import { Box, Typography, useTheme, List, ListItem, ListItemText, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import Navbar from './Navbar';
import Footer from './Footer';
import { fetchAllGames } from '../services/api';

// Import platform icons. Make sure these are the correct paths.
import gogIcon from '../assets/gog.png';
import epicIcon from '../assets/epic.png';
import steamIcon from '../assets/steam.png';
import amazonIcon from '../assets/amazon.png';

//pretty things
import fifty from '../assets/500.png';
import procio from '../assets/procio.png';

// Helper function to format the game name for an IGDB URL.
const gameTitleFormatter = (name) => {
  if (!name) {
    return '';
  }

  let formattedTitle = name.toLowerCase();
  formattedTitle = formattedTitle.replace(/\s*-\s*/g, '-');
  formattedTitle = formattedTitle.replace(/[^a-z0-9\s-]/g, '').trim();
  formattedTitle = formattedTitle.replace(/\s+/g, '-');

  return formattedTitle;
};

// Define the platform icons map here so it can be used throughout the component.
const platformIcons = {
  gog: gogIcon,
  epic: epicIcon,
  steam: steamIcon,
  amazon: amazonIcon,
};

const Home = () => {
  const theme = useTheme();
  // State to store the list of games and manage UI interactions.
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  // useEffect to fetch all games from the API when the component mounts.
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

  // Sorts the games by the number of owners (descending) and then by name.
  const sortedGames = games
    .slice()
    .sort((a, b) => {
      if (b.users.length !== a.users.length) {
        return b.users.length - a.users.length;
      }
      return a.name.localeCompare(b.name);
    });

  // Handles the click on a game item, setting the selected game and opening the popup.
  const handleGameClick = (game) => {
    setSelectedGame(game);
    setIsPopupOpen(true);
  };

  // Closes the popup and resets the selected game state.
  const handleClosePopup = () => {
    setIsPopupOpen(false);
    setSelectedGame(null);
  };

  return (
    <Box sx={theme.components.MuiBox.styleOverrides.root}>
      <Navbar />

      <Box component="main" sx={{ flexGrow: 1, padding: 4 }}>
        <Typography variant="h4" sx={{ mb: 0, display: 'flex', alignItems: 'center' }}>
          <img src={fifty} alt="500" style={{ width: 150, height: 120, }} />
          <Box sx={{ flexGrow: 1, textAlign: 'center' }}>
            Er mejo de 'sti stanchi! <br />
            La crema de la crema!
          </Box>
          <img src={procio} alt="Sir Procione III" style={{ width: 80, height: 80, marginLeft: 50 }} />
        </Typography>

        {/* Conditionally renders the list of games if data is available. */}
        {sortedGames.length > 0 ? (
          <List>
            {/* Maps through the sorted games to render each one as a list item. */}
            {sortedGames.map((game) => (
              <ListItem
                key={game.name} // Using a stable key for performance.
                sx={{
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: theme.palette.primary.light,
                  },
                }}
                onClick={() => handleGameClick(game)}
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
            ))}
          </List>
        ) : (
          <Typography variant="body1">Nessun gioco trovato.</Typography>
        )}
      </Box>

      <Footer />

      {/* Dialog (Popup) component to display game details and owners. */}
      <Dialog
        open={isPopupOpen}
        onClose={handleClosePopup}
        PaperProps={{
          sx: { minWidth: '40%' },
        }}
      >
        <DialogTitle>{selectedGame?.name}</DialogTitle>
        <DialogContent>
          {/* IGDB Link */}
          <Typography variant="body1" sx={{ mb: 2 }}>
            <a
              href={`https://www.igdb.com/games/${gameTitleFormatter(selectedGame?.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: theme.palette.secondary.main }}
            >
              IGDB Page
            </a>
          </Typography>

          {/* List of Owners */}
          <Typography variant="h6" sx={{ mb: 1 }}>
            Proprietari:
          </Typography>
          <List>
            {/* Iterates over the users array to display each owner's name and platform icons. */}
            {selectedGame?.users.map((user, index) => (
              <ListItem key={index}>
                <ListItemText primary={user.user} /> 
                <Box sx={{ display: 'flex', gap: 1, ml: 2 }}>
                  {/* Maps through the platforms array for each user to display the corresponding icon. */}
                  {user.platform.map((platform, platformIndex) => (
                    <img
                      key={platformIndex}
                      src={platformIcons[platform]}
                      alt={platform}
                      style={{ width: 20, height: 20 }}
                    />
                  ))}
                </Box>
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