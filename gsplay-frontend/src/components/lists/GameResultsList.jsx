import React from 'react';
import {
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
import { filterPlatforms } from '../../utils/formatters';

const GameResultsList = ({ games, loading, onGameClick }) => {
  if (loading) {
    return (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 3,
        }}
      >
        {Array.from({ length: 12 }).map((_, index) => (
          <Card key={index}>
            <Skeleton variant="rectangular" sx={{ aspectRatio: '3/4' }} />
            <CardContent>
              <Skeleton variant="text" height={28} width="80%" />
              <Skeleton variant="text" height={20} width="60%" />
              <Box sx={{ mt: 2 }}>
                <Skeleton variant="rectangular" height={24} width="40%" />
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  }

  if (games.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6" color="text.secondary">
          Nessun gioco trovato
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Prova a modificare i criteri di ricerca o i filtri
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 3,
      }}
    >
      {games.map((game) => (
        <Card
          key={game._id}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            cursor: 'pointer',
            transition: 'transform 0.2s, box-shadow 0.2s',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: (theme) => theme.tokens.shadows.medium,
            },
          }}
          onClick={() => onGameClick(game)}
        >
          <CardMedia
            component="img"
            image={game.artwork || '/placeholder-game.jpg'}
            alt={game.name}
            sx={{
              width: '100%',
              aspectRatio: '3/4', // consistent portrait format
              objectFit: 'contain', // no cropping, whole image shown
              bgcolor: 'grey.200',
            }}
            onError={(e) => {
              e.target.src = '/placeholder-game.jpg';
            }}
          />

          <CardContent
            sx={{
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Title */}
            <Typography
              variant="h6"
              gutterBottom
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                minHeight: '48px', // keeps consistent space
              }}
            >
              {game.name}
            </Typography>

            {/* Rating */}
            {game.rating && (
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Rating
                  value={game.rating / 20}
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
                {game.genres.slice(0, 2).map((genre) => (
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
              return (
                filteredPlatforms.length > 0 && (
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {filteredPlatforms.slice(0, 3).join(', ')}
                      {filteredPlatforms.length > 3 &&
                        ` +${filteredPlatforms.length - 3} altri`}
                    </Typography>
                  </Box>
                )
              );
            })()}

            {/* Owner Count */}
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 'auto' }}>
              <PeopleIcon
                sx={{ mr: 0.5, fontSize: 16, color: 'text.secondary' }}
              />
              <Typography variant="body2" color="text.secondary">
                {game.ownerCount}{' '}
                {game.ownerCount === 1 ? 'proprietario' : 'proprietari'}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};

export default GameResultsList;
