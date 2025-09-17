// src/services/api.js
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
        const refreshResponse = await api.post('/refresh-token', {});
        // Update user state if refresh was successful
        if (refreshResponse.data && refreshResponse.data.user) {
          // Dispatch custom event to update AuthContext
          window.dispatchEvent(new CustomEvent('tokenRefreshed', {
            detail: refreshResponse.data
          }));
        }
        return api(originalRequest);
      } catch (refreshError) {
        console.warn('Session expired. User is not logged in.');
        // Clear user state on refresh failure
        window.dispatchEvent(new CustomEvent('tokenRefreshFailed'));
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Single request helper
const request = async (method, url, data = null) => {
  try {
    const response = await api({ method, url, data });
    return response.data;
  } catch (error) {
    const enhancedError = {
      ...error.response?.data,
      message: `${method} ${url} failed: ${
        error.response?.data?.error || error.message || 'Unknown error'
      }`,
    };
    throw enhancedError;
  }
};

// API functions
export const login = (credentials) => request('POST', '/login', credentials);
export const signup = (userData) => request('POST', '/signup', userData);
export const logout = () => request('POST', '/logout');
export const setSteamId = (steamId) => request('POST', '/set-steam-id', { steamId });
export const fetchMe = () => request('GET', '/users/me');
export const fetchAllUsers = () => request('GET', '/users');
export const deleteUser = (userId) => request('DELETE', `/users/${userId}`);
export const refreshGames = () => request('POST', '/refresh-games');
export const fetchGames = () => request('GET', '/user/games').then((res) => res.games);
export const fetchAllGames = () => request('GET', '/users/games/all');
export const fetchUserGameCount = (userId) => request('GET', `/user/${userId}/game-count`);

// Import game libraries
export const importLibrary = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return request('POST', '/import-library', formData);
};
