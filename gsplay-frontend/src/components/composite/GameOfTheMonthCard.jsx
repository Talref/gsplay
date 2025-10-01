import React, { useState } from 'react';
import { Box, Typography, TextField, Button, useTheme } from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import RetroCard from '../ui/RetroCard';
import ProgressBar from '../ui/ProgressBar';
import AchievementGallery from './AchievementGallery';
import UserProgressList from './UserProgressList';
import useGameOfMonth from '../../hooks/useGameOfMonth';

const GameOfTheMonthCard = ({ sx = {} }) => {
  const theme = useTheme();
  const { user } = useAuth();
  const {
    game,
    loading,
    error: gameError,
    averageCompletion,
    userCount,
    achievementCount,
    updateDescription
  } = useGameOfMonth();

  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);
  const [descriptionError, setDescriptionError] = useState('');

  const handleEditDescriptionClick = () => {
    setEditDescription(game?.description || '');
    setDescriptionError('');
    setIsEditingDescription(true);
  };

  const handleSaveDescriptionClick = async () => {
    setSavingDescription(true);
    setDescriptionError('');
    try {
      await updateDescription(editDescription);
      setIsEditingDescription(false);
    } catch (error) {
      setDescriptionError('Failed to save description. Please try again.');
    } finally {
      setSavingDescription(false);
    }
  };

  const handleCancelDescriptionClick = () => {
    setIsEditingDescription(false);
    setEditDescription('');
  };

  if (loading) {
    return (
      <RetroCard variant="gom" sx={{ width: '100%', mt: 3, ...sx }}>
        <Box sx={{
          backgroundColor: theme.palette.primary.main,
          p: 2,
          borderRadius: '12px 12px 0 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Typography variant="retroTitleSmall" sx={{ color: theme.palette.primary.contrastText }}>
            Loading...
          </Typography>
        </Box>
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Loading Game of the Month...
          </Typography>
        </Box>
      </RetroCard>
    );
  }

  if (!game) {
    return (
      <RetroCard variant="gom" sx={{ width: '100%', mt: 3, ...sx }}>
        <Box sx={{
          backgroundColor: theme.palette.primary.main,
          p: 2,
          borderRadius: '12px 12px 0 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Typography variant="retroTitleSmall" sx={{ color: theme.palette.primary.contrastText }}>
            No Active Game
          </Typography>
        </Box>
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            No active Game of the Month. Check back later!
          </Typography>
        </Box>
      </RetroCard>
    );
  }

  return (
    <RetroCard variant="gom" sx={{ width: '100%', mt: 3, ...sx }}>
      {/* Header */}
      <Box sx={{
        backgroundColor: theme.palette.primary.main,
        p: theme.tokens.spacing.xs,
        borderRadius: `${theme.tokens.borderRadius.large}px ${theme.tokens.borderRadius.large}px 0 0`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Typography variant="retroTitleSmall" sx={{ color: theme.palette.primary.contrastText }}>
          {game.gameName}
        </Typography>
      </Box>

      {/* Content area - Box art and description side by side */}
      <Box sx={{
        px: theme.tokens.spacing.sm,
        py: theme.tokens.spacing.sm,
        display: 'flex',
        gap: theme.tokens.spacing.xs,
        minHeight: '300px',
        alignItems: 'flex-start'
      }}>
        {/* Box art on the left */}
        <Box sx={{
          flex: '0 0 180px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          {game.imageBoxArt ? (
            <Box
              component="img"
              src={`https://retroachievements.org${game.imageBoxArt}`}
              alt={`${game.gameName} box art`}
              sx={{
                maxWidth: '250px',
                maxHeight: '250px',
                objectFit: 'contain',
                borderRadius: 1,
                boxShadow: 3
              }}
            />
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No image available
            </Typography>
          )}
        </Box>

        {/* Description on the right */}
        <Box sx={{ flex: 1, textAlign: 'justify' }}>
          <Typography variant="body1" sx={{ mb: 1, color: 'text.primary' }}>
            {game.consoleName}
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            {game.achievements?.length || 0} achievements • {game.users?.length || 0} players
          </Typography>

          {isEditingDescription ? (
            <Box>
              <TextField
                fullWidth
                multiline
                rows={4}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Enter game description..."
                sx={{
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'background.default',
                  }
                }}
              />
              {descriptionError && (
                <Typography variant="body2" sx={{ color: 'error.main', mb: 2 }}>
                  {descriptionError}
                </Typography>
              )}
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                <Button size="small" onClick={handleCancelDescriptionClick}>
                  Cancel
                </Button>
                <Button
                  size="small"
                  variant="accent"
                  onClick={handleSaveDescriptionClick}
                  disabled={savingDescription}
                >
                  {savingDescription ? 'Saving...' : 'Save'}
                </Button>
              </Box>
            </Box>
          ) : (
            <Box>
              <Typography variant="body1" sx={{
                mb: 2,
                whiteSpace: 'pre-wrap',
                color: 'text.primary',
                minHeight: '60px'
              }}>
                {game.description || 'No description available.'}
              </Typography>

              {user?.isAdmin && (
                <Button size="small" variant="default" onClick={handleEditDescriptionClick}>
                  ✏️ Edit Description
                </Button>
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* Average completion section */}
      {game.users && game.users.length > 0 && (
        <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="retroText" sx={{ textAlign: 'center' }}>
            Completamento medio del gioco
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 3, mr: 3, mt: 3 }}>
            <Box sx={{ flex: 1 }}>
              <ProgressBar
                value={averageCompletion}
                height={12}
                showPercentage={false}
              />
            </Box>
            <Typography variant="retroText" sx={{ minWidth: '60px', textAlign: 'right', fontWeight: 'bold' }}>
              {averageCompletion}%
            </Typography>
          </Box>
        </Box>
      )}

      {/* Top Achievements Gallery */}
      <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
        <AchievementGallery
          achievements={game.achievements || []}
          title="Top Achievements"
          badgeSize={64}
        />
      </Box>

      {/* Completion Rankings */}
      {game.users && game.users.length > 0 && (
        <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
          <UserProgressList
            users={game.users}
            title="Rank Completamento"
            variant="completion"
            maxUsers={10}
          />
        </Box>
      )}

      {/* Points Rankings */}
      {game.users && game.users.length > 0 && (
        <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
          <UserProgressList
            users={game.users.map(user => ({
              ...user,
              achievements: game.achievements // Pass achievements for points calculation
            }))}
            title="Rank Punteggio"
            variant="points"
            showAchievements={true}
            maxUsers={10}
          />
        </Box>
      )}
    </RetroCard>
  );
};

export default GameOfTheMonthCard;
