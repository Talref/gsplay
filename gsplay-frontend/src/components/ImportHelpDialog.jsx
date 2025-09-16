import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, Box, Link, Typography, useTheme } from '@mui/material';

const ImportHelpDialog = ({ open, onClose }) => {
  const theme = useTheme();

  return (
    <Dialog
      open={open}
      onClose={onClose}
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
            <li>Apri:<br />
              C:\Users\NOME_UTENTE\AppData\Roaming\heroic\store_cache (Windows) o:<br />
              ~/.config/heroic/store_cache/ (Linux)<br />
              (attenzione, i percorsi derivano da test, se avete i file in un altra posizione pingatemi sul server - @eradan)
            </li>
            <li>Carica i file rilevanti che finiscono in "library" cliccando su "Importa GOG/Epic" (gog_library.json per GOG, legendary_library.json per Epic e nile_library.json per Amazon Games)</li>
          </Box>
          <Typography variant="body2" sx={{ mt: 2 }}>
            Fatto! Ricorda di ricaricare i file ogni tanto se aggiungi nuovi giochi!
          </Typography>
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onClose}
          variant="default"
        >
          Chiudi
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImportHelpDialog;
