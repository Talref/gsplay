import React, { useState, useEffect, useRef } from 'react';
import { Box, Button, Typography, useTheme, Snackbar, Alert, List, Link } from '@mui/material'; 
import { useAuth } from '../../context/AuthContext';
import Navbar from '../layout/Navbar';
import Footer from '../layout/Footer';
import { setSteamId, importLibrary } from '../../services/api';
import { gameTitleFormatter } from '../../utils/formatters';
import useUserGames from '../../hooks/useUserGames';
import SteamIdHelpDialog from '../dialogs/SteamIdHelpDialog';
import ImportHelpDialog from '../dialogs/ImportHelpDialog';
import SteamIdInputDialog from '../dialogs/SteamIdInputDialog';
import UserGameListItem from '../lists/UserGameListItem';

const YourLibrary = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('info');
  const { games, loading, error, refreshGames: refreshUserGames } = useUserGames(); 
  const [steamIdHelpOpen, setSteamIdHelpOpen] = useState(false);
  const [importHelpOpen, setImportHelpOpen] = useState(false);
  const [steamIdInputOpen, setSteamIdInputOpen] = useState(false); 
  const fileInputRef = useRef(null);

  // Refresh the game list  
  const handleRefreshGames = async () => {
    const result = await refreshUserGames();
    setSnackbarMessage(result.message);
    setSnackbarSeverity(result.success ? 'success' : 'error');
    setSnackbarOpen(true);
  };

  // Set Steam ID
  const handleSetSteamIdClick = () => {
    setSteamIdInputOpen(true); // Open the SteamID input dialog
  };

  const handleSaveSteamId = async (steamId) => {
    setSteamIdInputOpen(false); // Close the dialog
    if (steamId) {
      try {
        await setSteamId(steamId);
        setSnackbarMessage('SteamID inserito correttamente!');
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
      } catch (error) {
        setSnackbarMessage('Errore nel configurare il tuo steamID.');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        console.error('Error setting SteamID:', error);
      }
    }
  };

  // Import Library
  const handleImportClick = () => {
    fileInputRef.current.click(); // trigger hidden input
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const response = await importLibrary(file);
      // Refresh the games list to get the updated data from the server
      await refreshUserGames();
      setSnackbarMessage("ANVEDI QUANTI GIOCHI SEI UN VERO GAMER!!!!1!!!");
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      setSnackbarMessage(error.message || 'Errore di importazione. Riprova.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      console.error('Import error:', error);
    } finally {
      e.target.value = null; // reset input so same file can be uploaded again if needed
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  // Function to handle clicking on a game
  const handleGameClick = (name) => {
    const gameUrl = `https://www.igdb.com/games/${gameTitleFormatter(name)}`;
    window.open(gameUrl, '_blank');
  };

  return (
    <Box sx={theme.components.MuiBox.styleOverrides.root}>
      {/* Navbar at the top */}
      <Navbar />

      {/* Main content */}
      <Box sx={{ padding: 4 }}>
        <Typography variant="h4" sx={{ mb: 2 }}>
          La Tua Libbreria
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Refresh Library button */}
          <Button variant="default" onClick={handleRefreshGames}>
            Daje Co Steam
          </Button>

          <Button variant="default" onClick={handleImportClick}>
            Daje Co GOG/EPIC
          </Button>
          <input 
            type="file" 
            accept="application/json" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={handleFileChange} 
          />

          {/* Add/Change SteamID button */}
          <Button variant="accent" onClick={handleSetSteamIdClick}>
            {user?.steamId ? 'Cambia SteamID' : 'Aggiungi SteamID'}
          </Button>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', padding:2, gap: 3 }}>
          {/* SteamID Help link */}
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
        
          {/* Import Help link */}
          <Link 
            component="button" 
            variant="body1" 
            onClick={() => setImportHelpOpen(true)}
            sx={{
              color: theme.palette.secondary.main,
              textDecoration: 'underline',
              cursor: 'pointer',
              '&:hover': {
                color: theme.palette.secondary.light,
              }
            }}
          >
            Come importo da GOG/Epic/Amazon?
          </Link>
        </Box>

        {/* SteamID Help Dialog */}
        <SteamIdHelpDialog
          open={steamIdHelpOpen}
          onClose={() => setSteamIdHelpOpen(false)}
        />

        {/* Import Help Dialog */}
        <ImportHelpDialog
          open={importHelpOpen}
          onClose={() => setImportHelpOpen(false)}
        />

        {/* Display the game list */}
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            I Giochi A Cui Non Giochi Mai ({games.length}):
          </Typography>
          {games.length > 0 ? (
            <List>
              {games.map((game) => (
                <UserGameListItem
                  key={`${game.name}-${game.platform}`}
                  game={game}
                  onClick={handleGameClick}
                />
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

      {/* SteamID Input Dialog */}
      <SteamIdInputDialog
        open={steamIdInputOpen}
        onClose={() => setSteamIdInputOpen(false)}
        onSave={handleSaveSteamId}
      />
    </Box>
  );
};

export default YourLibrary;
