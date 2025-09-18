import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogContentText, TextField, DialogActions, Button, useTheme } from '@mui/material';

const SteamIdInputDialog = ({ open, onClose, onSave }) => {
  const theme = useTheme();
  const [steamId, setSteamId] = useState('');

  const handleSave = () => {
    onSave(steamId);
    setSteamId(''); // Clear input after saving
  };

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
      <DialogTitle>Inserisci il tuo SteamID</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: theme.palette.text.primary }}>
          Per aggiornare la tua libreria Steam, inserisci il tuo SteamID (SteamID64).
        </DialogContentText>
        <TextField
          autoFocus
          margin="dense"
          label="SteamID"
          type="text"
          fullWidth
          variant="standard"
          value={steamId}
          onChange={(e) => setSteamId(e.target.value)}
          sx={{
            '& .MuiInputBase-input': {
              color: theme.palette.text.primary, // Text color
            },
            '& .MuiInputLabel-root': {
              color: theme.palette.text.secondary, // Label color
            },
            '& .MuiInput-underline:before': {
              borderBottomColor: theme.palette.text.secondary, // Underline color before focus
            },
            '& .MuiInput-underline:hover:before': {
              borderBottomColor: theme.palette.primary.main, // Underline color on hover
            },
            '& .MuiInput-underline:after': {
              borderBottomColor: theme.palette.primary.main, // Underline color after focus
            },
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="default">
          Annulla
        </Button>
        <Button onClick={handleSave} variant="accent">
          Salva
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SteamIdInputDialog;
