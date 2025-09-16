import { useState, useEffect } from 'react';
import { fetchGames, refreshGames } from '../services/api';
import { useAuth } from '../context/AuthContext';

const useUserGames = () => {
  const { user } = useAuth();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadGames = async () => {
    if (!user) {
      setGames([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const gamesData = await fetchGames();
      const sortedGames = [...gamesData].sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      setGames(sortedGames);
    } catch (err) {
      console.error('Error fetching user games:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGames();
  }, [user]); // Reload games when user changes

  const handleRefreshGames = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await refreshGames();
      const sortedGames = [...response.games].sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      setGames(sortedGames);
      return { success: true, message: "UEEEEEE, GRANDE QUANTI CAZZO DE GIOCHI DA CHILO AOOOOO!!!!" };
    } catch (err) {
      console.error('Error refreshing games:', err);
      setError(err);
      return { success: false, message: 'Errore nel recuperare i giochi. Hai inserito il tuo SteamID?' };
    } finally {
      setLoading(false);
    }
  };

  return { games, loading, error, refreshGames: handleRefreshGames, loadGames };
};

export default useUserGames;
