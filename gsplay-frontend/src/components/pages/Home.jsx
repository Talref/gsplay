import React, { useState } from 'react';
import { Box, Typography, useTheme, List } from '@mui/material'; // Removed ListItem, ListItemText
import Navbar from '../layout/Navbar';
import Footer from '../layout/Footer';
import useGameList from '../../hooks/useGameList'; // Import the new hook
import GameDetailsDialog from '../dialogs/GameDetailsDialog'; // Import the new dialog component
import GameListItem from '../lists/GameListItem'; // Import the new GameListItem component

//pretty things
import fifty from '../../assets/500.png';
import procio from '../../assets/procio.png';

const Home = () => {
  const theme = useTheme();
  // State to store the list of games and manage UI interactions.
  const { games: sortedGames, loading, error } = useGameList(); // Use the new hook
  const [selectedGame, setSelectedGame] = useState(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);

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
              <GameListItem
                key={game.name}
                game={game}
                onClick={handleGameClick}
              />
            ))}
          </List>
        ) : (
          <Typography variant="body1">Nessun gioco trovato.</Typography>
        )}
      </Box>

      <Footer />

      {/* Dialog (Popup) component to display game details and owners. */}
      <GameDetailsDialog
        open={isPopupOpen}
        onClose={handleClosePopup}
        game={selectedGame}
      />
    </Box>
  );
};

export default Home;
