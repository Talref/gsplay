import React, { useState, useEffect } from 'react';
import { Box, Typography, useTheme, List, ListItem, ListItemText, Button, Snackbar, Alert, Grid, Paper, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, TextField } from '@mui/material';
import Navbar from '../layout/Navbar';
import Footer from '../layout/Footer';
import ProtectedRoute from '../composite/ProtectedRoute';
import { fetchAllUsers, deleteUser, restoreFailedGames, forceGameEnrichment, scanAllUsersGames, dropGamesCollection, getGameStats, setGameOfMonth } from '../../services/api';

const AdminPage = () => {
  const theme = useTheme();
  const [users, setUsers] = useState([]); // State to store all users
  const [snackbarOpen, setSnackbarOpen] = useState(false); // State for Snackbar
  const [snackbarMessage, setSnackbarMessage] = useState(''); // Snackbar message
  const [snackbarSeverity, setSnackbarSeverity] = useState('info'); // Snackbar severity
  const [restoreLoading, setRestoreLoading] = useState(false); // Loading state for restore button
  const [enrichLoading, setEnrichLoading] = useState(false); // Loading state for enrichment button
  const [scanLoading, setScanLoading] = useState(false); // Loading state for scan button
  const [gameStats, setGameStats] = useState(null); // Game statistics
  const [statsLoading, setStatsLoading] = useState(true); // Loading state for stats
  const [confirmDialog, setConfirmDialog] = useState({ open: false, action: '', message: '' }); // Confirmation dialog
  const [gomDialogOpen, setGomDialogOpen] = useState(false); // Game of Month dialog
  const [gameIdInput, setGameIdInput] = useState(''); // Game ID input
  const [setGomLoading, setSetGomLoading] = useState(false); // Loading state for set GoM

  // Fetch all users and game stats on component mount
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const usersData = await fetchAllUsers();
        setUsers(usersData);
      } catch (error) {
        console.error('Error fetching users:', error);
        setSnackbarMessage('Error fetching users.');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      }
    };

    const loadGameStats = async () => {
      try {
        const stats = await getGameStats();
        setGameStats(stats);
      } catch (error) {
        console.error('Error fetching game stats:', error);
      } finally {
        setStatsLoading(false);
      }
    };

    loadUsers();
    loadGameStats();
  }, []);

  // Handle deleting a user
  const handleDeleteUser = async (userId) => {
    try {
      await deleteUser(userId);
      setUsers((prevUsers) => prevUsers.filter((user) => user._id !== userId)); // Remove user from the list
      setSnackbarMessage('User deleted successfully.');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error deleting user:', error);
      setSnackbarMessage('Error deleting user.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  // Handle restoring failed games
  const handleRestoreFailedGames = async () => {
    setRestoreLoading(true);
    try {
      const result = await restoreFailedGames();
      setSnackbarMessage(result.message);
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error restoring failed games:', error);
      setSnackbarMessage('Error restoring failed games.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setRestoreLoading(false);
    }
  };

  // Handle forcing game enrichment
  const handleForceEnrichment = async () => {
    setEnrichLoading(true);
    try {
      const result = await forceGameEnrichment();
      setSnackbarMessage(result.message);
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error forcing enrichment:', error);
      setSnackbarMessage('Error forcing game enrichment.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setEnrichLoading(false);
    }
  };

  // Handle scanning all users games
  const handleScanAllUsers = async () => {
    setScanLoading(true);
    try {
      const result = await scanAllUsersGames();
      setSnackbarMessage(result.message);
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error scanning all users games:', error);
      setSnackbarMessage('Error scanning all users games.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setScanLoading(false);
    }
  };

  // Handle dropping games collection with confirmation
  const handleDropGamesCollection = () => {
    setConfirmDialog({
      open: true,
      action: 'dropGamesCollection',
      message: '⚠️ WARNING: This will permanently delete ALL games from the database but keep all users intact. Game data cannot be recovered. Are you absolutely sure you want to continue?'
    });
  };

  // Execute the confirmed action
  const handleConfirmAction = async () => {
    if (confirmDialog.action === 'dropGamesCollection') {
      try {
        const result = await dropGamesCollection();
        setSnackbarMessage(result.message);
        setSnackbarSeverity('warning');
        setSnackbarOpen(true);
        // Reload the page after dropping games collection
        setTimeout(() => window.location.reload(), 2000);
      } catch (error) {
        console.error('Error dropping games collection:', error);
        setSnackbarMessage('Error dropping games collection.');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      }
    }
    setConfirmDialog({ open: false, action: '', message: '' });
  };

  // Handle closing the Snackbar
  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  // Handle closing confirmation dialog
  const handleCloseConfirmDialog = () => {
    setConfirmDialog({ open: false, action: '', message: '' });
  };

  // Handle opening Game of Month dialog
  const handleOpenGomDialog = () => {
    setGomDialogOpen(true);
  };

  // Handle closing Game of Month dialog
  const handleCloseGomDialog = () => {
    setGomDialogOpen(false);
    setGameIdInput('');
  };

  // Handle setting Game of Month
  const handleSetGameOfMonth = async () => {
    const gameId = parseInt(gameIdInput.trim());
    if (!gameId || isNaN(gameId)) {
      setSnackbarMessage('Please enter a valid game ID (numeric only).');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    setSetGomLoading(true);
    try {
      const result = await setGameOfMonth(gameId);
      const { gomId, gameName, action } = result.data;
      const actionText = action === 'reactivated' ? 'reactivated' : 'set';
      setSnackbarMessage(`Game of the Month ${actionText} successfully! GoM ID: ${gomId} (${gameName})`);
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      handleCloseGomDialog();
    } catch (error) {
      console.error('Error setting game of month:', error);
      setSnackbarMessage('Error setting game of month. Please check the game ID and try again.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setSetGomLoading(false);
    }
  };

  return (
    <ProtectedRoute adminOnly>
      <Box sx={theme.components.MuiBox.styleOverrides.root}>
        {/* Navbar at the top */}
        <Navbar />

        {/* Main content */}
        <Box component="main" sx={{ flexGrow: 1, padding: 4 }}>
          <Typography variant="h4" sx={{ mb: 2 }}>
            Admin Dashboard
          </Typography>

          {/* Game Statistics */}
          <Paper sx={{ p: 3, mb: 4, backgroundColor: theme.palette.background.paper }}>
            <Typography variant="h6" sx={{ mb: 2, color: theme.palette.text.primary }}>
              Game Database Statistics
            </Typography>
            {statsLoading ? (
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                Loading statistics...
              </Typography>
            ) : gameStats ? (
              <Grid container spacing={3}>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
                      {gameStats.totalGames}
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                      Total Games
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" sx={{ color: theme.palette.success.main, fontWeight: 'bold' }}>
                      {gameStats.enrichedGames}
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                      Enriched
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" sx={{ color: theme.palette.warning.main, fontWeight: 'bold' }}>
                      {gameStats.unenrichedGames}
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                      Pending
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" sx={{ color: theme.palette.error.main, fontWeight: 'bold' }}>
                      {gameStats.failedGames}
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                      Failed
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ textAlign: 'center', mt: 2 }}>
                    <Typography variant="h6" sx={{ color: theme.palette.text.primary }}>
                      Success Rate: {gameStats.successRate}%
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            ) : (
              <Typography variant="body2" sx={{ color: theme.palette.error.main }}>
                Failed to load statistics
              </Typography>
            )}
          </Paper>

          {/* Admin Controls */}
          <Paper sx={{ p: 3, mb: 4, backgroundColor: theme.palette.primary.main }}>
            <Typography variant="h6" sx={{ mb: 2, color: theme.palette.text.primary }}>
              Game Database Management
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Button
                  fullWidth
                  variant="contained"
                  color="secondary"
                  onClick={handleRestoreFailedGames}
                  disabled={restoreLoading}
                  sx={{ py: 1.5 }}
                >
                  {restoreLoading ? 'Restoring...' : 'Restore Failed Games'}
                </Button>
                <Typography variant="caption" sx={{ mt: 1, display: 'block', color: theme.palette.text.secondary }}>
                  Reset failed enrichments for retry
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Button
                  fullWidth
                  variant="contained"
                  color="info"
                  onClick={handleScanAllUsers}
                  disabled={scanLoading}
                  sx={{ py: 1.5 }}
                >
                  {scanLoading ? 'Scanning...' : 'Scan All Users'}
                </Button>
                <Typography variant="caption" sx={{ mt: 1, display: 'block', color: theme.palette.text.secondary }}>
                  Add all user games to database (no enrichment)
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  onClick={handleForceEnrichment}
                  disabled={enrichLoading}
                  sx={{ py: 1.5 }}
                >
                  {enrichLoading ? 'Enriching...' : 'Force Game Enrichment'}
                </Button>
                <Typography variant="caption" sx={{ mt: 1, display: 'block', color: theme.palette.text.secondary }}>
                  Manually trigger enrichment process
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          {/* RetroAchievements Management */}
          <Paper sx={{ p: 3, mb: 4, backgroundColor: theme.palette.success.main }}>
            <Typography variant="h6" sx={{ mb: 2, color: theme.palette.text.primary }}>
              🕹️ RetroAchievements Management
            </Typography>
            <Typography variant="body2" sx={{ mb: 3, color: theme.palette.text.secondary }}>
              Set up monthly gaming challenges for your community. Track progress, achievements, and friendly competition.
            </Typography>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              onClick={handleOpenGomDialog}
              sx={{
                py: 2,
                fontWeight: 'bold',
                fontSize: '1.1rem',
                backgroundColor: theme.palette.primary.dark,
                '&:hover': {
                  backgroundColor: theme.palette.primary.main,
                }
              }}
            >
              🎮 Start New Game of the Month
            </Button>
            <Typography variant="caption" sx={{ mt: 1, display: 'block', color: theme.palette.text.secondary, textAlign: 'center' }}>
              Enter a RetroAchievements game ID to begin tracking community progress
            </Typography>
          </Paper>

          {/* Users List */}
          <Typography variant="h6" sx={{ mb: 2 }}>
            Users
          </Typography>
          {users.length > 0 ? (
            <List>
              {users.map((user) => (
                <ListItem
                  key={user._id}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: theme.palette.primary.dark,
                    borderRadius: '5px',
                    marginBottom: '8px',
                    padding: '8px 16px',
                  }}
                >
                  <ListItemText
                    primary={user.name}
                    secondary={user.isAdmin ? 'Admin' : 'User'}
                    primaryTypographyProps={{
                      color: theme.palette.text.primary,
                      fontWeight: '500',
                    }}
                    secondaryTypographyProps={{
                      color: theme.palette.text.secondary,
                    }}
                  />
                  <Button
                    variant="warning"
                    onClick={() => handleDeleteUser(user._id)}
                    sx={{ ml: 2 }}
                  >
                    Delete
                  </Button>
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body1">No users found.</Typography>
          )}

          {/* Danger Zone */}
          <Paper sx={{ p: 3, mt: 4, backgroundColor: theme.palette.error.main, border: `2px solid ${theme.palette.error.dark}` }}>
            <Typography variant="h6" sx={{ mb: 2, color: theme.palette.error.contrastText, fontWeight: 'bold' }}>
              ⚠️ DANGER ZONE
            </Typography>
            <Typography variant="body2" sx={{ mb: 3, color: theme.palette.error.contrastText }}>
              These actions are irreversible and will permanently delete data. Use with extreme caution.
            </Typography>
            <Button
              fullWidth
              variant="contained"
              color="error"
              onClick={handleDropGamesCollection}
              sx={{
                py: 2,
                fontWeight: 'bold',
                fontSize: '1.1rem',
                backgroundColor: theme.palette.error.dark,
                '&:hover': {
                  backgroundColor: theme.palette.error.main,
                }
              }}
            >
              🗑️ CLEAR GAMES COLLECTION
            </Button>
            <Typography variant="caption" sx={{ mt: 1, display: 'block', color: theme.palette.error.contrastText, textAlign: 'center' }}>
              This will delete ALL games but keep users intact
            </Typography>
          </Paper>
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

        {/* Confirmation Dialog */}
        <Dialog
          open={confirmDialog.open}
          onClose={handleCloseConfirmDialog}
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-description"
        >
          <DialogTitle id="confirm-dialog-title" sx={{ color: theme.palette.error.main, fontWeight: 'bold' }}>
            ⚠️ DANGER: Irreversible Action
          </DialogTitle>
          <DialogContent>
            <DialogContentText id="confirm-dialog-description" sx={{ color: theme.palette.text.primary }}>
              {confirmDialog.message}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseConfirmDialog} color="primary">
              Cancel
            </Button>
            <Button
              onClick={handleConfirmAction}
              color="error"
              variant="contained"
              autoFocus
            >
              Yes, I'm Sure
            </Button>
          </DialogActions>
        </Dialog>

        {/* Game of Month Dialog */}
        <Dialog
          open={gomDialogOpen}
          onClose={handleCloseGomDialog}
          aria-labelledby="gom-dialog-title"
          aria-describedby="gom-dialog-description"
        >
          <DialogTitle id="gom-dialog-title" sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
            🎮 Start New Game of the Month
          </DialogTitle>
          <DialogContent>
            <DialogContentText id="gom-dialog-description" sx={{ mb: 2, color: theme.palette.text.primary }}>
              Enter the RetroAchievements game ID to set up a new monthly challenge. You can find game IDs on the RetroAchievements website.
            </DialogContentText>
            <TextField
              autoFocus
              margin="dense"
              id="gameId"
              label="Game ID"
              type="number"
              fullWidth
              variant="outlined"
              value={gameIdInput}
              onChange={(e) => setGameIdInput(e.target.value)}
              placeholder="e.g., 11296"
              helperText="Numeric ID from RetroAchievements.org"
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: theme.palette.primary.main,
                  },
                  '&:hover fieldset': {
                    borderColor: theme.palette.primary.dark,
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: theme.palette.primary.main,
                  },
                },
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseGomDialog} color="secondary">
              Cancel
            </Button>
            <Button
              onClick={handleSetGameOfMonth}
              color="primary"
              variant="contained"
              disabled={setGomLoading || !gameIdInput.trim()}
            >
              {setGomLoading ? 'Setting up...' : 'Start Game of the Month'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ProtectedRoute>
  );
};

export default AdminPage;
