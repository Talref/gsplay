//api.js
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Auto-refresh logic
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        await axios.post('/api/refresh-token', {}, { withCredentials: true });
        return api(originalRequest);
      } catch (refreshError) {
        console.error('Session expired. Redirecting to login.');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

// Single request helper (keeps route-specific errors)
const request = async (method, url, data = null) => {
  try {
    const response = await api({ method, url, data });
    return response.data;
  } catch (error) {
    // Enhance error with route info (e.g., "POST /login failed: Invalid credentials")
    const enhancedError = {
      ...error.response?.data,
      message: `${method} ${url} failed: ${error.response?.data?.error || 'Unknown error'}`,
    };
    throw enhancedError;
  }
};


// exports
export const login = (credentials) => request('POST', '/login', credentials);
export const signup = (userData) => request('POST', '/signup', userData);
export const logout = () => request('POST', '/logout');
export const setSteamId = (steamId) => request('POST', '/set-steam-id', { steamId });
export const fetchAllUsers = () => request('GET', '/users');
export const deleteUser = (userId) => request('DELETE', `/users/${userId}`);
export const deleteAccount = () => request('DELETE', '/delete');
export const refreshGames = () => request('POST', '/refresh-games');
export const fetchGames = () => request('GET', '/user/games').then(res => res.games);
export const fetchAllGames = () => request('GET', '/users/games/all');

// import files to backend
export const importLibrary = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return request('POST', '/import-library', formData);
};
