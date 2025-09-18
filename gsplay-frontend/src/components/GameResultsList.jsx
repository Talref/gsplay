import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Chip,
  Box,
  Skeleton,
  Rating
} from '@mui/material';
import { People as PeopleIcon } from '@mui/icons-material';
import { filterPlatforms } from '../utils/formatters';

const GameResultsList = ({ games, loading, onGameClick }) => {
  if (loading) {
    return (
      <Grid container spacing={3}>
        {Array.from({ length: 6 }).map((_, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card>
              <Skeleton variant="rectangular" height={200} />
              <CardContent>
                <Skeleton variant="text" height={28} width="80%" />
                <Skeleton variant="text" height={20} width="60%" />
                <Box sx={{ mt: 2 }}>
                  <Skeleton variant="rectangular" height={24} width="40%" />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  }

  if (games.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6" color="text.secondary">
          No games found
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Try adjusting your search criteria or filters
        </Typography>
      </Box>
    );
  }

  return (
    <Grid container spacing={3}>
      {games.map(game => (
        <Grid item xs={12} sm={6} md={4} key={game._id}>
          <Card
            sx={{
              height: '100%',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: 4
              }
            }}
            onClick={() => onGameClick(game)}
          >
            <CardMedia
              component="img"
              height="200"
              image={game.artwork || '/placeholder-game.jpg'}
              alt={game.name}
              sx={{
                objectFit: 'cover',
                bgcolor: 'grey.200'
              }}
              onError={(e) => {
                e.target.src = '/placeholder-game.jpg';
              }}
            />
            <CardContent sx={{ flexGrow: 1 }}>
              <Typography variant="h6" component="h2" gutterBottom sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical'
              }}>
                {game.name}
              </Typography>

              {/* Rating */}
              {game.rating && (
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Rating
                    value={game.rating / 20} // IGDB rating is 0-100, MUI Rating is 0-5
                    readOnly
                    precision={0.5}
                    size="small"
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                    ({Math.round(game.rating)})
                  </Typography>
                </Box>
              )}

              {/* Genres */}
              {game.genres && game.genres.length > 0 && (
                <Box sx={{ mb: 1 }}>
                  {game.genres.slice(0, 2).map(genre => (
                    <Chip
                      key={genre}
                      label={genre}
                      size="small"
                      variant="outlined"
                      sx={{ mr: 0.5, mb: 0.5 }}
                    />
                  ))}
                  {game.genres.length > 2 && (
                    <Chip
                      label={`+${game.genres.length - 2}`}
                      size="small"
                      variant="outlined"
                      sx={{ mr: 0.5, mb: 0.5 }}
                    />
                  )}
                </Box>
              )}

              {/* Platforms */}
              {(() => {
                const filteredPlatforms = filterPlatforms(game.availablePlatforms);
                return filteredPlatforms.length > 0 && (
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {filteredPlatforms.slice(0, 3).join(', ')}
                      {filteredPlatforms.length > 3 && ` +${filteredPlatforms.length - 3} more`}
                    </Typography>
                  </Box>
                );
              })()}

              {/* Owner Count */}
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 'auto' }}>
                <PeopleIcon sx={{ mr: 0.5, fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                  {game.ownerCount} {game.ownerCount === 1 ? 'owner' : 'owners'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default GameResultsList;
