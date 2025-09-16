import { useState, useEffect } from 'react';
import { fetchAllGames } from '../services/api';

const useGameList = () => {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadGames = async () => {
      try {
        setLoading(true);
        const gamesData = await fetchAllGames();
        setGames(gamesData);
      } catch (err) {
        console.error('Error fetching games:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    loadGames();
  }, []);

  // Sorts the games by the number of owners (descending) and then by name.
  const sortedGames = games
    .slice()
    .sort((a, b) => {
      if (b.users.length !== a.users.length) {
        return b.users.length - a.users.length;
      }
      return a.name.localeCompare(b.name);
    });

  return { games: sortedGames, loading, error };
};

export default useGameList;
