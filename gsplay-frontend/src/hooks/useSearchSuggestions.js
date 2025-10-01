// src/hooks/useSearchSuggestions.js
import { useState, useCallback, useRef } from 'react';
import { searchGames } from '../services/api';

// Debounce utility
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

export const useSearchSuggestions = () => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isVisible, setIsVisible] = useState(false);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (query) => {
      if (query.length < 3) {
        setSuggestions([]);
        setIsVisible(false);
        return;
      }

      setLoading(true);
      try {
        const result = await searchGames({
          name: query,
          limit: 3, // Only first 3 suggestions
          sortBy: 'name',
          sortOrder: 'asc'
        });

        setSuggestions(result.games);
        setIsVisible(result.games.length > 0);
        setSelectedIndex(-1);
      } catch (error) {
        console.error('Search suggestions error:', error);
        setSuggestions([]);
        setIsVisible(false);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  // Handle input changes
  const handleInputChange = useCallback((value) => {
    debouncedSearch(value);
  }, [debouncedSearch]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event, inputValue, onSelect) => {
    if (!isVisible || suggestions.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;

      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;

      case 'Enter':
        event.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          onSelect(suggestions[selectedIndex]);
        } else {
          // Always trigger search with current input (whether from suggestion or typing)
          onSelect(null, inputValue);
        }
        break;

      case 'Escape':
        event.preventDefault();
        setIsVisible(false);
        setSelectedIndex(-1);
        break;
    }
  }, [isVisible, suggestions, selectedIndex]);

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback((suggestion) => {
    setIsVisible(false);
    setSelectedIndex(-1);
    return suggestion;
  }, []);

  // Hide suggestions
  const hideSuggestions = useCallback(() => {
    setIsVisible(false);
    setSelectedIndex(-1);
  }, []);

  return {
    suggestions,
    loading,
    selectedIndex,
    isVisible,
    handleInputChange,
    handleKeyDown,
    handleSuggestionSelect,
    hideSuggestions
  };
};
