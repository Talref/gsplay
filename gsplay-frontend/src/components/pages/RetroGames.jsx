import React, { useState, useEffect } from 'react';
import { Box, Typography, useTheme, TextField, Button, Paper, LinearProgress } from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { getActiveGameOfMonth, updateActiveGameDescription } from '../../services/api';
import Navbar from '../layout/Navbar';
import Footer from '../layout/Footer';

const RetroGames = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const [pageText, setPageText] = useState('RetroAchievements Game of the Month - Coming Soon!');
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [activeGom, setActiveGom] = useState(null);
  const [gomLoading, setGomLoading] = useState(true);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editDescription, setEditDescription] = useState('');

  // Load text from localStorage on component mount
  useEffect(() => {
    const savedText = localStorage.getItem('retrogames-page-text');
    if (savedText) {
      setPageText(savedText);
    }
  }, []);

  // Load active Game of the Month on component mount
  useEffect(() => {
    const loadActiveGom = async () => {
      try {
        const result = await getActiveGameOfMonth();
        setActiveGom(result.data);
      } catch (error) {
        console.log('No active Game of the Month found');
        setActiveGom(null);
      } finally {
        setGomLoading(false);
      }
    };

    loadActiveGom();
  }, []);

  const handleEditClick = () => {
    setEditText(pageText);
    setIsEditing(true);
  };

  const handleSaveClick = () => {
    setPageText(editText);
    localStorage.setItem('retrogames-page-text', editText);
    setIsEditing(false);
  };

  const handleCancelClick = () => {
    setIsEditing(false);
    setEditText('');
  };

  const handleEditDescriptionClick = () => {
    setEditDescription(activeGom?.description || '');
    setIsEditingDescription(true);
  };

  const handleSaveDescriptionClick = async () => {
    try {
      await updateActiveGameDescription(editDescription);
      setActiveGom(prev => prev ? { ...prev, description: editDescription } : null);
      setIsEditingDescription(false);
    } catch (error) {
      console.error('Error updating description:', error);
    }
  };

  const handleCancelDescriptionClick = () => {
    setIsEditingDescription(false);
    setEditDescription('');
  };

  return (
    <Box sx={theme.components.MuiBox.styleOverrides.root}>
      {/* Navbar at the top */}
      <Navbar />

      {/* Main content */}
      <Box sx={{
        padding: 4,
        width: '50%',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center'
      }}>
        <Typography variant="retroTitle" sx={{ mb: 3 }}>
          Retrogaming Club
        </Typography>

        {/* Page content */}
        <Box>
          {isEditing ? (
            <Paper sx={{ p: 3, backgroundColor: theme.palette.background.paper }}>
              <Typography variant="h6" sx={{ mb: 2, color: theme.palette.text.primary }}>
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
                    backgroundColor: theme.palette.background.default,
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
                {pageText}
              </Typography>

              {user?.isAdmin && (
                <Button variant="default" onClick={handleEditClick} sx={{ mt: 2 }}>
                  ✏️ Edit Page Content
                </Button>
              )}
            </Box>
          )}
        </Box>

        {/* Gioco del Mese subtitle */}
        <Typography variant="retroTitleSmall" sx={{ mt: 4 }}>
          Gioco del Mese
        </Typography>

        {/* Game of the Month content box */}
        <Box sx={{
          width: '100%',
          mt: 3,
          borderRadius: 3,
          border: `2px solid ${theme.palette.secondary.main}`,
          backgroundColor: theme.palette.background.paper,
          minHeight: '200px',
          overflow: 'hidden'
        }}>
          {/* Header with different color */}
          <Box sx={{
            backgroundColor: theme.palette.primary.main,
            p: 2,
            borderRadius: '12px 12px 0 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {gomLoading ? (
              <Typography variant="retroTitleSmall" sx={{ color: theme.palette.primary.contrastText }}>
                Loading...
              </Typography>
            ) : activeGom ? (
              <Typography variant="retroTitleSmall" sx={{ color: theme.palette.primary.contrastText }}>
                {activeGom.gameName}
              </Typography>
            ) : (
              <Typography variant="retroTitleSmall" sx={{ color: theme.palette.primary.contrastText }}>
                No Active Game
              </Typography>
            )}
          </Box>

          {/* Content area - Box art and description side by side */}
          <Box sx={{
            px: 4,
            py: 3,
            display: 'flex',
            gap: 3,
            minHeight: '200px',
            alignItems: 'flex-start'
          }}>
            {/* Box art on the left */}
            <Box sx={{
              flex: '0 0 200px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              {gomLoading ? (
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  Loading...
                </Typography>
              ) : activeGom?.imageBoxArt ? (
                <Box
                  component="img"
                  src={`https://retroachievements.org${activeGom.imageBoxArt}`}
                  alt={`${activeGom.gameName} box art`}
                  sx={{
                    maxWidth: '180px',
                    maxHeight: '180px',
                    objectFit: 'contain',
                    borderRadius: 1,
                    boxShadow: 2
                  }}
                />
              ) : (
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  No image available
                </Typography>
              )}
            </Box>

            {/* Description on the right */}
            <Box sx={{ flex: 1, textAlign:'justify' }}>
              {gomLoading ? (
                <Typography variant="body1" sx={{ color: theme.palette.text.secondary }}>
                  Loading Game of the Month...
                </Typography>
              ) : activeGom ? (
                <Box>
                  <Typography variant="body1" sx={{ mb: 1, color: theme.palette.text.primary }}>
                    {activeGom.consoleName}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2, color: theme.palette.text.secondary }}>
                    {activeGom.achievements?.length || 0} achievements • {activeGom.users?.length || 0} players
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
                            backgroundColor: theme.palette.background.default,
                          }
                        }}
                      />
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        <Button size="small" onClick={handleCancelDescriptionClick}>
                          Cancel
                        </Button>
                        <Button size="small" variant="accent" onClick={handleSaveDescriptionClick}>
                          Save
                        </Button>
                      </Box>
                    </Box>
                  ) : (
                    <Box>
                      <Typography variant="body1" sx={{
                        mb: 2,
                        whiteSpace: 'pre-wrap',
                        color: theme.palette.text.primary,
                        minHeight: '60px'
                      }}>
                        {activeGom.description || 'No description available.'}
                      </Typography>

                      {user?.isAdmin && (
                        <Button size="small" variant="default" onClick={handleEditDescriptionClick}>
                          ✏️ Edit Description
                        </Button>
                      )}
                    </Box>
                  )}
                </Box>
              ) : (
                <Typography variant="body1" sx={{ color: theme.palette.text.secondary }}>
                  No active Game of the Month. Check back later!
                </Typography>
              )}
            </Box>
          </Box>

          {/* Completamento medio del gioco section */}
          <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="retroText" sx={{ textAlign: 'center' }}>
              Completamento medio del gioco
            </Typography>

            {activeGom?.users && activeGom.users.length > 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 3, mr: 3, mt: 3}}>
                <Box sx={{ flex: 1, }}>
                  <LinearProgress
                    variant="determinate"
                    value={(() => {
                      const totalCompletion = activeGom.users.reduce((sum, user) => sum + (user.completionPercentage || 0), 0);
                      return Math.round(totalCompletion / activeGom.users.length);
                    })()}
                    sx={{
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: theme.palette.background.default,
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: theme.palette.secondary.main,
                        borderRadius: 6,
                      },
                    }}
                  />
                </Box>
                <Typography variant="retroText" sx={{ minWidth: '60px', textAlign: 'right', fontWeight: 'bold' }}>
                  {(() => {
                    const totalCompletion = activeGom.users.reduce((sum, user) => sum + (user.completionPercentage || 0), 0);
                    const average = Math.round(totalCompletion / activeGom.users.length);
                    return `${average}%`;
                  })()}
                </Typography>
              </Box>
            ) : (
              <Typography variant="body2" sx={{ textAlign: 'center', color: theme.palette.text.secondary }}>
                No completion data available
              </Typography>
            )}
          </Box>

          {/* Top Achievements Gallery */}
          <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="retroText" sx={{ mb: 2, textAlign: 'center' }}>
              Top Achievements
            </Typography>

            {activeGom?.achievements && activeGom.achievements.length > 0 ? (
              <Box sx={{
                display: 'flex',
                gap: 1,
                overflowX: 'auto',
                overflowY: 'hidden',
                mt: 3,
                mb: 2,
                pb: 1,
                px: 2,
                '&::-webkit-scrollbar': {
                  height: '10px',
                },
                '&::-webkit-scrollbar-track': {
                  backgroundColor: theme.palette.background.default,
                  borderRadius: '8px',
                  border: `1px solid ${theme.palette.divider}`,
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: theme.palette.secondary.main,
                  borderRadius: '8px',
                  border: `2px solid ${theme.palette.background.paper}`,
                  '&:hover': {
                    backgroundColor: theme.palette.secondary.dark,
                  },
                },
                '&::-webkit-scrollbar-corner': {
                  backgroundColor: theme.palette.background.paper,
                },
              }}>
                {activeGom.achievements
                  .map(achievement => ({
                    ...achievement,
                    totalOwners: achievement.softcoreOwners.length + achievement.hardcoreOwners.length
                  }))
                  .sort((a, b) => b.totalOwners - a.totalOwners)
                  .map((achievement) => (
                    <Box
                      key={achievement.achievementId}
                      sx={{
                        position: 'relative',
                        flexShrink: 0,
                        width: 64,
                        height: 64,
                        borderRadius: 1,
                        overflow: 'hidden',
                        border: `2px solid ${achievement.totalOwners > 0 ? theme.palette.secondary.main : theme.palette.divider}`,
                        transition: 'all 0.2s ease',
                        cursor: 'pointer',
                        filter: achievement.totalOwners === 0 ? 'grayscale(100%) opacity(0.4)' : 'none',
                        '&:hover': {
                          transform: 'scale(1.1)',
                          filter: achievement.totalOwners === 0 ? 'grayscale(100%) opacity(0.6)' : 'brightness(1.1)',
                          zIndex: 10,
                        },
                      }}
                      title={`${achievement.name} (${achievement.points} points) - Owned by ${achievement.totalOwners} players`}
                    >
                      <Box
                        component="img"
                        src={`https://retroachievements.org/Badge/${achievement.badgeId}.png`}
                        alt={achievement.name}
                        sx={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                        onError={(e) => {
                          e.target.src = '/placeholder-game.jpg'; // Fallback image
                        }}
                      />

                      {/* Ownership indicator */}
                      {achievement.totalOwners > 0 && (
                        <Box sx={{
                          position: 'absolute',
                          bottom: 0,
                          right: 0,
                          backgroundColor: theme.palette.primary.main,
                          color: theme.palette.primary.contrastText,
                          fontSize: '0.7rem',
                          fontWeight: 'bold',
                          px: 0.5,
                          py: 0.2,
                          borderRadius: '4px 0 0 0',
                          fontFamily: 'RetroGaming8Bit, monospace',
                        }}>
                          {achievement.totalOwners}
                        </Box>
                      )}
                    </Box>
                  ))}
              </Box>
            ) : (
              <Typography variant="body2" sx={{ textAlign: 'center', color: theme.palette.text.secondary }}>
                No achievements available
              </Typography>
            )}
          </Box>

          {/* Rank Completamento section */}
          <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="retroText" sx={{ textAlign: 'center' }}>
              Rank Completamento
            </Typography>

            {activeGom?.users && activeGom.users.length > 0 ? (
              <Box sx={{ mt: 3 }}>
                {activeGom.users
                  .sort((a, b) => (b.completionPercentage || 0) - (a.completionPercentage || 0))
                  .map((user, index) => (
                    <Box key={user.userId} sx={{ mb: 2, ml: 3, mr: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography variant="retroTextSmall" sx={{ minWidth: '30px', fontWeight: 'bold', color: theme.palette.text.primary }}>
                          #{index + 1}  {user.username}
                        </Typography>
                        <Typography variant="retroTextSmall" sx={{ flex: 1, minWidth: '50px', textAlign: 'right', fontWeight: 'bold' }}>
                          {user.completionPercentage || 0}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={user.completionPercentage || 0}
                        sx={{
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: theme.palette.background.default,
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: theme.palette.secondary.main, // Same color as average bar
                            borderRadius: 4,
                          },
                        }}
                      />
                    </Box>
                  ))}
              </Box>
            ) : (
              <Typography variant="body2" sx={{ textAlign: 'center', color: theme.palette.text.secondary, mt: 2 }}>
                No player data available
              </Typography>
            )}
          </Box>

          {/* Rank Punteggio section */}
          <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="retroText" sx={{ textAlign: 'center' }}>
              Rank Punteggio
            </Typography>

            {activeGom?.users && activeGom.users.length > 0 ? (
              <Box sx={{ mt: 3 }}>
                {activeGom.users
                  .sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0))
                  .map((user, index) => {
                    // Get user's earned achievements
                    const userAchievements = activeGom.achievements
                      .filter(achievement =>
                        achievement.softcoreOwners.includes(user.userId) ||
                        achievement.hardcoreOwners.includes(user.userId)
                      )
                      .sort((a, b) => b.points - a.points); // Sort by points descending

                    return (
                      <Box key={user.userId} sx={{ mb: 3, ml: 3, mr: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                          <Typography variant="retroTextSmall" sx={{ minWidth: '30px', fontWeight: 'bold', color: theme.palette.text.primary }}>
                            #{index + 1}  {user.username}
                          </Typography>
                          <Typography variant="retroTextSmall" sx={{ flex: 1, minWidth: '60px', textAlign: 'right', fontWeight: 'bold' }}>
                            {user.totalPoints || 0} pts
                          </Typography>
                        </Box>

                        {/* User's achievements */}
                        {userAchievements.length > 0 ? (
                          <Box sx={{
                            display: 'flex',
                            gap: 0.5,
                            overflowX: 'auto',
                            overflowY: 'hidden',
                            pb: 1,
                            '&::-webkit-scrollbar': {
                              height: '6px',
                            },
                            '&::-webkit-scrollbar-track': {
                              backgroundColor: theme.palette.background.default,
                              borderRadius: '3px',
                            },
                            '&::-webkit-scrollbar-thumb': {
                              backgroundColor: theme.palette.secondary.main,
                              borderRadius: '3px',
                            },
                          }}>
                            {userAchievements.map((achievement) => (
                              <Box
                                key={achievement.achievementId}
                                sx={{
                                  position: 'relative',
                                  flexShrink: 0,
                                  width: 40,
                                  height: 40,
                                  borderRadius: 1,
                                  overflow: 'hidden',
                                  border: `1px solid ${theme.palette.secondary.main}`,
                                }}
                                title={`${achievement.name} (${achievement.points} points)`}
                              >
                                <Box
                                  component="img"
                                  src={`https://retroachievements.org/Badge/${achievement.badgeId}.png`}
                                  alt={achievement.name}
                                  sx={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                  }}
                                  onError={(e) => {
                                    e.target.src = '/placeholder-game.jpg';
                                  }}
                                />

                                {/* Point value overlay */}
                                <Box sx={{
                                  position: 'absolute',
                                  bottom: 0,
                                  right: 0,
                                  backgroundColor: theme.palette.primary.main,
                                  color: theme.palette.primary.contrastText,
                                  fontSize: '0.6rem',
                                  fontWeight: 'bold',
                                  px: 0.3,
                                  py: 0.1,
                                  borderRadius: '2px 0 0 0',
                                  fontFamily: 'RetroGaming8Bit, monospace',
                                }}>
                                  {achievement.points}
                                </Box>
                              </Box>
                            ))}
                          </Box>
                        ) : (
                          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontStyle: 'italic' }}>
                            No achievements earned yet
                          </Typography>
                        )}
                      </Box>
                    );
                  })}
              </Box>
            ) : (
              <Typography variant="body2" sx={{ textAlign: 'center', color: theme.palette.text.secondary, mt: 2 }}>
                No player data available
              </Typography>
            )}
          </Box>
        </Box>
      </Box>

      {/* Footer */}
      <Footer />
    </Box>
  );
};

export default RetroGames;
