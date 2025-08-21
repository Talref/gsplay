import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  useTheme, 
  Snackbar, 
  Alert, 
  List, 
  ListItem, 
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Link
} from '@mui/material';
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
  const [steamIdHelpOpen, setSteamIdHelpOpen] = useState(false);

  // Fetch the user's game list on component mount
  useEffect(() => {
    const loadGames = async () => {
      try {
        const gamesData = await fetchGames();
        const sortedGames = [...gamesData].sort((a, b) => 
          a.name.localeCompare(b.name)
        );
        setGames(sortedGames);
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
          La Tua Libreria
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Refresh Library button */}
          <Button variant="default" onClick={handleRefreshGames}>
            Aggiorna Libreria
          </Button>

          {/* Add/Change SteamID button */}
          <Button variant="accent" onClick={handleSetSteamId}>
            {user?.steamId ? 'Cambia SteamID' : 'Aggiungi SteamID'}
          </Button>

          {/* Help link */}
          <Link 
            component="button" 
            variant="body1" 
            onClick={() => setSteamIdHelpOpen(true)}
            sx={{
              color: theme.palette.secondary.main,
              textDecoration: 'underline',
              cursor: 'pointer',
              '&:hover': {
                color: theme.palette.secondary.light,
              }
            }}
          >
            Come trovo il mio SteamID?
          </Link>
        </Box>

        {/* SteamID Help Dialog */}
        <Dialog
          open={steamIdHelpOpen}
          onClose={() => setSteamIdHelpOpen(false)}
          PaperProps={{
            sx: {
              backgroundColor: theme.palette.background.paper,
              color: theme.palette.text.primary,
            }
          }}
        >
          <DialogTitle>Come trovare lo SteamID</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ color: theme.palette.text.primary }}>
              Per Trovare il tuo steamID:
              <Box component="ol" sx={{ 
                pl: 4, // Increased left padding for indentation
                '& li': {
                  mb: 1.5, // Increased margin bottom for each list item
                  lineHeight: 1.6, // Increased line height
                }
              }}>
                <li>Visita il tuo <Link href="https://steamcommunity.com/my/" target="_blank" rel="noopener">profilo Steam</Link> (log in se necessario)</li>
                <li>Il tuo SteamID sono le ultime 17 cifre dell'URL</li>
                <li>Se il tuo profilo steam non finisce con lo SteamID visita <Link href="https://steamid.io/" target="_blank" rel="noopener">SteamID.io</Link> ed incolla il link del tuo profilo</li>
                <li>SteamID.io calcolera' il tuo SteamID dal link (quello corretto e' SteamID64).</li>
                <li>Inserisci il tuo SteamID nel form di questa pagina</li>
              </Box>
              <Typography variant="body2" sx={{ mt: 2 }}>
                Non c'e' bisogno di ripetere questa operazione. Se aggiungete nuovi giochi alla vostra libreria basta cliccare su Aggiorna Libreria.
              </Typography>
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => setSteamIdHelpOpen(false)} 
              variant="default"
            >
              Chiudi
            </Button>
          </DialogActions>
        </Dialog>

        {/* Display the game list */}
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            I Tuoi Giochi
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
            <Typography variant="body1">Nessun gioco trovato, aggiorna la tua libreria, aggiungi il tuo SteamID o carica una lista di giochi.</Typography>
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