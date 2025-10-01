import { useState, useEffect, useMemo } from 'react';
import { getActiveGameOfMonth, updateActiveGameDescription } from '../services/api';

/**
 * Custom hook for managing Game of the Month data and operations
 * @returns {Object} Hook state and methods
 */
const useGameOfMonth = () => {
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load game data on mount
  useEffect(() => {
    const loadGameOfMonth = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getActiveGameOfMonth();
        setGame(response.data);
      } catch (err) {
        console.error('Failed to load Game of the Month:', err);
        setError('Failed to load Game of the Month. Please try again later.');
        setGame(null);
      } finally {
        setLoading(false);
      }
    };

    loadGameOfMonth();
  }, []);

  // Memoized calculations
  const averageCompletion = useMemo(() => {
    if (!game?.users?.length) return 0;
    const sum = game.users.reduce((total, user) => total + (user.completionPercentage || 0), 0);
    return Math.round(sum / game.users.length);
  }, [game?.users]);

  const userCount = game?.users?.length || 0;
  const achievementCount = game?.achievements?.length || 0;

  /**
   * Updates the game's description
   * @param {string} newDescription
   * @returns {Promise<boolean>} Success status
   */
  const updateDescription = async (newDescription) => {
    if (!game) return false;

    try {
      await updateActiveGameDescription(newDescription);
      setGame(prev => prev ? { ...prev, description: newDescription } : null);
      return true;
    } catch (err) {
      console.error('Failed to update description:', err);
      throw new Error('Failed to save description. Please try again.');
    }
  };

  return {
    game,
    loading,
    error,
    averageCompletion,
    userCount,
    achievementCount,
    updateDescription
  };
};

export default useGameOfMonth;
