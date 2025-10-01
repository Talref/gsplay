import React, { useState } from 'react';
import { Box, Typography, TextField, Button, Paper } from '@mui/material';
import { useAuth } from '../../context/AuthContext';

const PageContentEditor = ({
  initialContent = 'RetroAchievements Game of the Month - Coming Soon!',
  onSave,
  sx = {}
}) => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(initialContent);

  const handleEditClick = () => {
    setEditText(initialContent);
    setIsEditing(true);
  };

  const handleSaveClick = () => {
    onSave(editText);
    setIsEditing(false);
  };

  const handleCancelClick = () => {
    setIsEditing(false);
    setEditText('');
  };

  return (
    <Box sx={sx}>
      {isEditing ? (
        <Paper sx={{ p: 3, backgroundColor: 'background.paper' }}>
          <Typography variant="h6" sx={{ mb: 2, color: 'text.primary' }}>
            Edit Page Content
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            placeholder="Enter page content..."
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                backgroundColor: 'background.default',
              }
            }}
          />
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button variant="default" onClick={handleCancelClick}>
              Cancel
            </Button>
            <Button variant="accent" onClick={handleSaveClick}>
              Save Changes
            </Button>
          </Box>
        </Paper>
      ) : (
        <Box>
          <Typography variant="body1" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
            {initialContent}
          </Typography>

          {user?.isAdmin && (
            <Button variant="default" onClick={handleEditClick} sx={{ mt: 2 }}>
              ✏️ Edit Page Content
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
};

export default PageContentEditor;
