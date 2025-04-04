// src/services/api.js
import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: '/api', 
  withCredentials: true, 
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
    return response.data; 
  } catch (error) {
    throw error.response.data;
  }
};

export const logout = async () => {
  await api.post('/logout'); 
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
    const response = await api.get('/users/games');
    return response.data.games;
  } catch (error) {
    throw error.response.data;
  }
};

export const fetchAllGames = async () => {
  try {
    const response = await api.get('/users/games/all');
    return response.data;
  } catch (error) {
    throw error.response.data;
  }
};