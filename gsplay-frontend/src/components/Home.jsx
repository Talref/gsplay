import React, { useState, useEffect } from 'react';
import { Box, Typography, useTheme, List, ListItem, ListItemText } from '@mui/material';
import Navbar from './Navbar';
import Footer from './Footer';
import { fetchAllGames } from '../services/api'; // Import the fetchAllGames function

const Home = () => {
  const theme = useTheme();
  const [games, setGames] = useState([]); // State to store the aggregated games list

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

  return (
    <Box sx={theme.components.MuiBox.styleOverrides.root}>
      {/* Navbar at the top */}
      <Navbar />

      {/* Main content */}
      <Box component="main" sx={{ flexGrow: 1, padding: 4 }}>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Most Popular Games
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
                  Owned by: {game.users.length}
                </Typography>
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography variant="body1">No games found.</Typography>
        )}
      </Box>

      {/* Footer */}
      <Footer />
    </Box>
  );
};

export default Home;