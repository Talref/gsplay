import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Pagination,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Search as SearchIcon, Sort as SortIcon } from '@mui/icons-material';
// Removed useNavigate - using inline details instead
import { searchGames, getFilterOptions } from '../../services/api';
import GamesFiltersSidebar from '../features/search/GamesFiltersSidebar';
import GameResultsList from '../lists/GameResultsList';
import GameDetailView from '../composite/GameDetailView';
import SearchSuggestions from '../composite/SearchSuggestions';
import Navbar from '../layout/Navbar';
import Footer from '../layout/Footer';
import { useSearchSuggestions } from '../../hooks/useSearchSuggestions';

const SearchGamesPage = () => {
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
  const [sortBy, setSortBy] = useState('name');
  const searchInputRef = useRef(null);
  // Search suggestions hook
  const {
    suggestions,
    loading: suggestionsLoading,
    selectedIndex,
    isVisible: suggestionsVisible,
    handleInputChange,
    handleKeyDown,
    handleSuggestionSelect,
    hideSuggestions
  } = useSearchSuggestions();

  // Load filter options on mount
  useEffect(() => {
    loadFilterOptions();
  }, []);

  // Load all games on initial mount and search when filters, sort, or page change
  useEffect(() => {
    if (Object.values(filterOptions).some(arr => arr.length > 0)) {
      performSearch();
    } else {
      performSearch();
    }
  }, [filters, pagination.page, sortBy]);

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
        sortBy: sortBy,
        sortOrder: sortBy === 'rating' ? 'desc' : 'asc'
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

  const handleSortChange = (event) => {
    setSortBy(event.target.value);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Search input handlers
  const handleSearchInputChange = (event) => {
    const value = event.target.value;
    setSearchTerm(value);
    handleInputChange(value);
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      hideSuggestions();
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        // Select game and show it inline in search page
        setSelectedGame(suggestions[selectedIndex]);
      } else {
        handleSearch();
      }
    } else {
      handleKeyDown(event, searchTerm, handleSuggestionSelect);
    }
  };

  const handleSuggestionClick = (suggestion, searchTerm) => {
    if (suggestion) {
      // Select game and show it inline in search page
      setSelectedGame(suggestion);
      hideSuggestions();
    } else if (searchTerm) {
      setSearchTerm(searchTerm);
      handleSearch();
    } else {
      handleSearch();
    }
  };

  // Hide suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchInputRef.current && !searchInputRef.current.contains(event.target)) {
        hideSuggestions();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [hideSuggestions]);

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
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <Box sx={{ flex: 1, position: 'relative' }}>
              <TextField
                ref={searchInputRef}
                fullWidth
                variant="outlined"
                placeholder="Cerca giochi..."
                value={searchTerm}
                onChange={handleSearchInputChange}
                onKeyDown={handleSearchKeyDown}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
              <SearchSuggestions
                suggestions={suggestions}
                loading={suggestionsLoading}
                selectedIndex={selectedIndex}
                isVisible={suggestionsVisible}
                onSelect={handleSuggestionClick}
                anchorEl={searchInputRef.current}
              />
            </Box>
            <Button
              variant="contained"
              onClick={handleSearch}
              disabled={loading}
              sx={{ height: 56, minWidth: 120 }}
            >
              {loading ? <CircularProgress size={24} /> : 'Cerca'}
            </Button>
          </Box>
        </Paper>

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Main Content - Desktop Only Layout */}
        <Box sx={{ display: 'flex', gap: 3 }}>
          {/* Left Sidebar - Filters */}
          <Box sx={{ width: 320, flexShrink: 0 }}>
            <Paper sx={{ p: 3, position: 'sticky', top: 20 }}>
              <GamesFiltersSidebar
                filters={filters}
                filterOptions={filterOptions}
                onFilterChange={handleFilterChange}
              />
            </Paper>
          </Box>

          {/* Right Content Area */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {selectedGame ? (
              <GameDetailView
                game={selectedGame}
                onBack={handleBackToSearch}
              />
            ) : (
              <>
                {/* Sort Header - Top of Right Area */}
                <Paper sx={{ p: 3, mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6">
                      {loading ? 'Caricamento...' : (games.length > 0 ? `${pagination.total} giochi trovati` : 'Nessun gioco trovato')}
                    </Typography>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                      <InputLabel>Ordina per</InputLabel>
                      <Select
                        value={sortBy}
                        label="Ordina per"
                        onChange={handleSortChange}
                        startAdornment={<SortIcon sx={{ mr: 1, color: 'text.secondary' }} />}
                      >
                        <MenuItem value="name">Alfabetico</MenuItem>
                        <MenuItem value="rating">Valutazioni</MenuItem>
                        <MenuItem value="ownerCount">Posseduti da</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                </Paper>

                {/* Game Results List */}
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
          </Box>
        </Box>
      </Container>
      <Footer />
    </Box>
  );
};

export default SearchGamesPage;
