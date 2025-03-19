// src/services/api.js
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api/users';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the token in headers
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const signup = async (userData) => {
  try {
    const response = await api.post('/signup', userData);
    return response.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const login = async (credentials) => {
  try {
    const response = await api.post('/login', credentials);
    localStorage.setItem('token', response.data.token); // Save token to localStorage
    return response.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const logout = () => {
  localStorage.removeItem('token'); // Remove token from localStorage
};

export const setSteamId = async (steamId) => {
  try {
    const response = await api.post('/set-steam-id', { steamId });
    return response.data;
  } catch (error) {
    throw error.response.data;
  }
};

// Fetch all users (admin only)
export const fetchAllUsers = async () => {
  try {
    const response = await api.get('/users');
    return response.data;
  } catch (error) {
    throw error.response.data;
  }
};

// Delete a user (admin only)
export const deleteUser = async (userId) => {
  try {
    const response = await api.delete(`/users/${userId}`);
    return response.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const deleteAccount = async () => {
  try {
    const response = await api.delete('/delete');
    localStorage.removeItem('token'); // Remove token after account deletion
    return response.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const refreshGames = async () => {
  try {
    const response = await api.post('/refresh-games');
    return response.data;
  } catch (error) {
    throw error.response.data;
  }
};

export const fetchGames = async () => {
  try {
    const response = await api.get('/games');
    return response.data.games; // Return the games array
  } catch (error) {
    throw error.response.data;
  }
};

export const fetchAllGames = async () => {
  try {
    const response = await api.get('/games/all');
    return response.data; // Return the aggregated games list
  } catch (error) {
    throw error.response.data;
  }
};