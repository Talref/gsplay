import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Typography,
  Grid,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  CircularProgress,
  Alert,
  Rating,
  Container
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  People as PeopleIcon,
  CalendarToday as CalendarIcon,
  Star as StarIcon
} from '@mui/icons-material';
import { getGameDetails } from '../../services/api';
import { filterPlatforms, groupOwnersByUser } from '../../utils/formatters';

// Import platform icons
import steamIcon from '../../assets/steam.png';
import epicIcon from '../../assets/epic.png';
import gogIcon from '../../assets/gog.png';
import amazonIcon from '../../assets/amazon.png';

// Platform icon mapping
const platformIcons = {
  steam: steamIcon,
  epic: epicIcon,
  gog: gogIcon,
  amazon: amazonIcon,
};

// Function to get platform icon
const getPlatformIcon = (platform) => {
  if (!platform) return null;
  const lowerPlatform = platform.toLowerCase();

  // Try exact match first
  if (platformIcons[lowerPlatform]) {
    return platformIcons[lowerPlatform];
  }

  // Try partial matches
  for (const [key, icon] of Object.entries(platformIcons)) {
    if (lowerPlatform.includes(key) || key.includes(lowerPlatform)) {
      return icon;
    }
  }

  return null;
};

const GameDetailView = ({ game, gameId, onBack }) => {
  const [gameData, setGameData] = useState(game);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Use loaded full gameData if available, fallback to game prop
  const currentGame = gameData || game;

  // Check if we have full enriched data (description/videos)
  const hasFullData = currentGame?.description !== undefined && currentGame?.videos !== undefined;

  // Load full game details if we have basic data but missing enriched fields
  useEffect(() => {
    if (currentGame && currentGame._id && !hasFullData) {
      loadFullGameDetails(currentGame._id);
    }
  }, [currentGame?._id, hasFullData]);

  const loadFullGameDetails = async (targetGameId) => {
    setLoading(true);
    setError(null);

    try {
      const fullGame = await getGameDetails(targetGameId);
      setGameData(fullGame);
    } catch (error) {
      setError(error.message || 'Failed to load game details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Back Button */}
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={onBack}
        variant="contained"
        color="primary"
        sx={{ mb: 3 }}
      >
        Torna alla Ricerca
      </Button>

      <Container maxWidth="xl">
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4, mb: 4 }}>
          {/* Game Cover and Basic Info */}
          <Box sx={{ flexShrink: 0, width: { xs: '100%', md: '25%' }, maxWidth: { md: '300px' } }}>
            <Card>
              <CardMedia
                component="img"
                image={currentGame.artwork || '/placeholder-game.jpg'}
                alt={currentGame.name}
                sx={{
                  width: '100%',
                  aspectRatio: '3/4', // consistent portrait format
                  objectFit: 'contain', // no cropping, whole image shown
                  bgcolor: 'grey.200'
                }}
                onError={(e) => {
                  e.target.src = '/placeholder-game.jpg';
                }}
              />
              <CardContent>
                <Typography
                  variant="h5"
                  component="h1"
                  gutterBottom
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical'
                  }}
                >
                  {currentGame.name}
                </Typography>

                {/* Rating */}
                {currentGame.rating && (
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Rating
                      value={currentGame.rating / 20}
                      readOnly
                      precision={0.5}
                      size="medium"
                    />
                    <Typography variant="body1" sx={{ ml: 1 }}>
                      {Math.round(currentGame.rating)}/100
                    </Typography>
                  </Box>
                )}

                {/* Release Date */}
                {currentGame.releaseDate && (
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <CalendarIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      Rilasciato: {new Date(currentGame.releaseDate).toLocaleDateString()}
                    </Typography>
                  </Box>
                )}

                {/* Owner Count */}
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <PeopleIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    {currentGame.ownerCount || groupOwnersByUser(currentGame.owners).length || 0} proprietari
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Box>

          {/* Game Details */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                Informazioni sul Gioco
              </Typography>
              <Typography variant="body1" sx={{ mb: 3 }}>
                {currentGame.description || 'Nessuna descrizione disponibile.'}
              </Typography>

              {/* Videos */}
              {currentGame.videos && currentGame.videos.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Video
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {currentGame.videos.map((videoId, index) => (
                      <Box key={videoId} sx={{ minWidth: 300, flex: '1 1 auto' }}>
                        <iframe
                          width="100%"
                          height="200"
                          src={`https://www.youtube.com/embed/${videoId}`}
                          title={`Game Video ${index + 1}`}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          style={{ borderRadius: 8 }}
                        />
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>

            {/* Genres */}
            {currentGame.genres && currentGame.genres.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Generi
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {currentGame.genres.map(genre => (
                    <Chip
                      key={genre}
                      label={genre}
                      variant="filled"
                      sx={{
                        bgcolor: 'secondary.light',
                        color: 'secondary.contrastText',
                        '&:hover': {
                          bgcolor: 'secondary.main'
                        }
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}

            {/* Platforms */}
            {(() => {
              const filteredPlatforms = filterPlatforms(currentGame.availablePlatforms);
              return filteredPlatforms.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Piattaforme
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {filteredPlatforms.map(platform => (
                      <Chip
                        key={platform}
                        label={platform}
                        variant="outlined"
                        color="secondary"
                      />
                    ))}
                  </Box>
                </Box>
              );
            })()}

            {/* Game Modes */}
            {currentGame.gameModes && currentGame.gameModes.length > 0 && (
              <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Modalità di Gioco
                  </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {currentGame.gameModes.map(mode => (
                    <Chip
                      key={mode}
                      label={mode}
                      variant="outlined"
                      color="info"
                    />
                  ))}
                </Box>
              </Box>
            )}

            {/* Publishers */}
            {currentGame.publishers && currentGame.publishers.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Editori
                </Typography>
                <Typography variant="body1">
                  {currentGame.publishers.join(', ')}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Container>

        {/* Owners Section */}
        {(() => {
          const groupedOwners = groupOwnersByUser(currentGame.owners);
          return groupedOwners.length > 0 && (
            <Container maxWidth="xl" sx={{ mt: 4 }}>
              <Divider sx={{ mb: 3 }} />
              <Typography variant="h6" gutterBottom>
                Proprietari del Gioco ({groupedOwners.length})
              </Typography>
              <List>
                {groupedOwners.map((owner, index) => (
                  <React.Fragment key={owner.userId}>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar>
                          {owner.name.charAt(0).toUpperCase()}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={owner.name}
                        secondary={
                          owner.platforms && owner.platforms.length > 0 ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                              {owner.platforms.map(platform => {
                                const iconPath = getPlatformIcon(platform);
                                return iconPath ? (
                                  <Box
                                    key={platform}
                                    component="img"
                                    src={iconPath}
                                    alt={platform}
                                    sx={{
                                      width: 20,
                                      height: 20,
                                      objectFit: 'contain'
                                    }}
                                  />
                                ) : (
                                  <Typography key={platform} variant="caption" sx={{ fontSize: '0.75rem' }}>
                                    {platform}
                                  </Typography>
                                );
                              })}
                            </Box>
                          ) : (
                            'Proprietario del gioco'
                          )
                        }
                      />
                    </ListItem>
                    {index < groupedOwners.length - 1 && <Divider variant="inset" />}
                  </React.Fragment>
                ))}
              </List>
            </Container>
          );
        })()}
      </Box>
  );
};

export default GameDetailView;
