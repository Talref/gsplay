import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Pagination,
  CircularProgress,
  Alert,
  IconButton,
  Drawer,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { Search as SearchIcon, FilterList as FilterIcon, Close as CloseIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { searchGames, getFilterOptions } from '../services/api';
import SearchFilters from './SearchFilters';
import GameResultsList from './GameResultsList';
import GameDetailView from './GameDetailView';
import Navbar from './Navbar';
import Footer from './Footer';

const GameSearchPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    genres: [],
    platforms: [],
    gameModes: []
  });
  const [filterOptions, setFilterOptions] = useState({
    genres: [],
    platforms: [],
    gameModes: []
  });
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(!isMobile);

  // Load filter options on mount
  useEffect(() => {
    loadFilterOptions();
  }, []);

  // Search when filters change
  useEffect(() => {
    if (Object.values(filterOptions).some(arr => arr.length > 0)) {
      performSearch();
    }
  }, [filters, pagination.page]);

  const loadFilterOptions = async () => {
    try {
      const options = await getFilterOptions();
      setFilterOptions(options);
    } catch (error) {
      console.error('Failed to load filter options:', error);
    }
  };

  const performSearch = async () => {
    setLoading(true);
    setError(null);

    try {
      const searchParams = {
        name: searchTerm,
        genres: filters.genres,
        platforms: filters.platforms,
        gameModes: filters.gameModes,
        page: pagination.page,
        limit: pagination.limit,
        sortBy: 'name',
        sortOrder: 'asc'
      };

      const result = await searchGames(searchParams);
      setGames(result.games);
      setPagination(result.pagination);
    } catch (error) {
      setError(error.message || 'Failed to search games');
      setGames([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    performSearch();
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (event, page) => {
    setPagination(prev => ({ ...prev, page }));
  };

  const handleGameClick = (game) => {
    setSelectedGame(game);
  };

  const handleBackToSearch = () => {
    setSelectedGame(null);
  };

  const toggleFilters = () => {
    setFiltersOpen(!filtersOpen);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <Container maxWidth="xl" sx={{ py: 4, flexGrow: 1 }}>
        <Typography variant="h3" component="h1" gutterBottom align="center">
          Scopri Giochi
        </Typography>
        <Typography variant="h6" color="text.secondary" align="center" sx={{ mb: 4 }}>
          Cerca ed esplora il nostro database di giochi
        </Typography>

      {/* Search Bar */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={10}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Cerca giochi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              fullWidth
              variant="contained"
              onClick={handleSearch}
              disabled={loading}
              sx={{ height: 56 }}
            >
              {loading ? <CircularProgress size={24} /> : 'Cerca'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Filters Sidebar */}
        <Grid item xs={12} md={3}>
          {isMobile ? (
            <Drawer
              anchor="left"
              open={filtersOpen}
              onClose={() => setFiltersOpen(false)}
              sx={{ '& .MuiDrawer-paper': { width: 300, p: 2 } }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">Filtri</Typography>
                <IconButton onClick={() => setFiltersOpen(false)}>
                  <CloseIcon />
                </IconButton>
              </Box>
              <SearchFilters
                filters={filters}
                filterOptions={filterOptions}
                onFilterChange={handleFilterChange}
              />
            </Drawer>
          ) : (
            filtersOpen && (
              <Paper sx={{ p: 3, position: 'sticky', top: 20 }}>
                <SearchFilters
                  filters={filters}
                  filterOptions={filterOptions}
                  onFilterChange={handleFilterChange}
                />
              </Paper>
            )
          )}
        </Grid>

        {/* Results */}
        <Grid item xs={12} md={filtersOpen ? 9 : 12}>
          {selectedGame ? (
            <GameDetailView
              game={selectedGame}
              onBack={handleBackToSearch}
            />
          ) : (
            <>
              <GameResultsList
                games={games}
                loading={loading}
                onGameClick={handleGameClick}
              />

              {/* Pagination */}
              {pagination.pages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                  <Pagination
                    count={pagination.pages}
                    page={pagination.page}
                    onChange={handlePageChange}
                    color="primary"
                    size="large"
                  />
                </Box>
              )}
            </>
          )}
        </Grid>
      </Grid>
      </Container>
      <Footer />
    </Box>
  );
};

export default GameSearchPage;
