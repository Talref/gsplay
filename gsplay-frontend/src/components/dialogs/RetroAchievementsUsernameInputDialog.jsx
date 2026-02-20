import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, TextField, Typography, Box } from '@mui/material';

const RetroAchievementsUsernameInputDialog = ({ open, onClose, onSave }) => {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      setError('Username can only contain letters, numbers, underscores, and hyphens');
      return;
    }

    onSave(username.trim());
    setUsername('');
    setError('');
  };

  const handleClose = () => {
    setUsername('');
    setError('');
    onClose();
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      handleSave();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
          🕹️ RetroAchievements Username
        </Typography>
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Linka il tuo account Retroachievements per partecipare ai contest della community.
        </DialogContentText>

        <TextField
          autoFocus
          margin="dense"
          label="Username"
          type="text"
          fullWidth
          variant="outlined"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setError('');
          }}
          onKeyPress={handleKeyPress}
          error={!!error}
          helperText={error || "Your username on RetroAchievements.org"}
          placeholder="e.g., eradan"
          sx={{
            '& .MuiOutlinedInput-root': {
              '& fieldset': {
                borderColor: 'primary.main',
              },
              '&:hover fieldset': {
                borderColor: 'primary.dark',
              },
              '&.Mui-focused fieldset': {
                borderColor: 'primary.main',
              },
            },
          }}
        />

        <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>
            📝 Come trovare il tuo username:
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            1. Vai a <a href="https://retroachievements.org" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2' }}>RetroAchievements.org</a>
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            2. Log in con il tuo account
          </Typography>
          <Typography variant="body2">
            3. Il tuo username e' in alto a sinistra.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="secondary">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          color="primary"
          variant="contained"
          disabled={!username.trim() || !!error}
        >
          Link Account
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RetroAchievementsUsernameInputDialog;
