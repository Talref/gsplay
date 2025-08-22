import React, { useState, useEffect, useRef } from 'react';
import { Box, Button, Typography, useTheme, Snackbar, Alert, List, ListItem, ListItemText, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Link } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import Navbar from './Navbar';
import Footer from './Footer';
import { refreshGames, setSteamId, fetchGames, importLibrary } from '../services/api';
import { gameTitleFormatter } from '../utils/formatters';

import gogIcon from '../assets/gog.png';
import epicIcon from '../assets/epic.png';
import steamIcon from '../assets/steam.png';
import amazonIcon from '../assets/amazon.png';

const YourLibrary = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('info');
  const [games, setGames] = useState([]);
  const [steamIdHelpOpen, setSteamIdHelpOpen] = useState(false);
  const [importHelpOpen, setImportHelpOpen] = useState(false);
  const fileInputRef = useRef(null);
  const platformIcons = {
    gog: gogIcon,
    epic: epicIcon,
    steam: steamIcon,
    amazon: amazonIcon,
  };

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

  // Refresh the game list  
  const handleRefreshGames = async () => {
    try {
      const response = await refreshGames();
      setSnackbarMessage("UEEEEEE, GRANDE QUANTI CAZZO DE GIOCHI DA CHILO AOOOOO!!!!")
      setSnackbarSeverity('success');
      setSnackbarOpen(true);

      // Use the game list from the refresh response, no second API call needed
      setGames(response.games);
    } catch (error) {
      setSnackbarMessage('Errore nel recuperare i giochi. Hai inserito il tuo SteamID?');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      console.error('Errore nel recuperare i giochi. Acciderboli!', error);
    }
  };

  // Set Steam ID
  const handleSetSteamId = async () => {
    const steamId = prompt('Inserisci il tuo SteamID:');
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
      setGames(response.games); // update local state with imported games
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
          <Button variant="accent" onClick={handleSetSteamId}>
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
            <DialogContentText component="div" sx={{ color: theme.palette.text.primary }}>
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

        {/* Import Help Dialog */}
        <Dialog
          open={importHelpOpen}
          onClose={() => setImportHelpOpen(false)}
          PaperProps={{
            sx: {
              backgroundColor: theme.palette.background.paper,
              color: theme.palette.text.primary,
            }
          }}
        >
          <DialogTitle>Come importare giochi da GOG/Epic/Amazon Games</DialogTitle>
          <DialogContent>
            <DialogContentText component="div" sx={{ color: theme.palette.text.primary }}>
              <Box component="ol" sx={{ 
                pl: 4, // Increased left padding for indentation
                '& li': {
                  mb: 1.5, // Increased margin bottom for each list item
                  lineHeight: 1.6, // Increased line height
                }
              }}>
                <li>Installa <Link href="https://heroicgameslauncher.com/" target="_blank" rel="noopener">Heroic Games Launcher</Link></li>
                <li>Collega i tuoi account e popola la tua libreria</li>
                <li>Apri C:\Users\NOME_UTENTE\AppData\Local\Programs\heroic (Windows), oppure ./config/heroic/store_cache/ (Linux)</li>
                <li>Carica i file rilevanti che finiscono in "library" cliccando su "Importa GOG/Epic" (gog_library.json per GOG, legendary_library.json per Epic e nile_library.json per Amazon Games)</li>
              </Box>
              <Typography variant="body2" sx={{ mt: 2 }}>
                Fatto! Ricorda di ricaricare i file ogni tanto se aggiungi nuovi giochi!
              </Typography>
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => setImportHelpOpen(false)} 
              variant="default"
            >
              Chiudi
            </Button>
          </DialogActions>
        </Dialog>

        {/* Display the game list */}
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            I Giochi A Cui Non Giochi Mai:
          </Typography>
          {games.length > 0 ? (
            <List>
              {games.map((game, index) => (
                <ListItem
                  key={index}
                  onClick={() => handleGameClick(game.name)} // Make the list item clickable
                  sx={{
                    cursor: 'pointer', // Change cursor to pointer on hover
                    '&:hover': {
                      backgroundColor: theme.palette.primary.light, // Highlight on hover
                    },
                  }}
                >
                <ListItemText primary={
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {game.name}
                  {game.platform && (
                    <img
                      src={platformIcons[game.platform]}
                      alt={game.platform}
                      style={{ width: 20, height: 20 }}
                    />
                  )}
                </span>
                  }
                />
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