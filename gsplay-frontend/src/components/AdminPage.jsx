import React, { useState, useEffect } from 'react';
import { Box, Typography, useTheme, List, ListItem, ListItemText, Button, Snackbar, Alert } from '@mui/material';
import Navbar from './Navbar';
import Footer from './Footer';
import ProtectedRoute from './ProtectedRoute';
import { fetchAllUsers, deleteUser } from '../services/api';

const AdminPage = () => {
  const theme = useTheme();
  const [users, setUsers] = useState([]); // State to store all users
  const [snackbarOpen, setSnackbarOpen] = useState(false); // State for Snackbar
  const [snackbarMessage, setSnackbarMessage] = useState(''); // Snackbar message
  const [snackbarSeverity, setSnackbarSeverity] = useState('info'); // Snackbar severity

  // Fetch all users on component mount
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

    loadUsers();
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

  // Handle closing the Snackbar
  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
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
    </ProtectedRoute>
  );
};

export default AdminPage;