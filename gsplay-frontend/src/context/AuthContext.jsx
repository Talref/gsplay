// src/context/AuthContext.js
import React, { createContext, useState, useEffect } from 'react';
import { login as apiLogin } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  // Check for token on initial load
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchUserData(token); // Fetch user data if token exists
    }
  }, []);

  const fetchUserData = async (token) => {
    try {
      const response = await fetch('/api/users/me', { // Use relative path
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const rawResponse = await response.text(); // Log the raw response
      console.log('Raw response:', rawResponse);
      if (response.ok) {
        const userData = JSON.parse(rawResponse); // Parse the response as JSON
        console.log('User data:', userData); // Log the user data
        setUser(userData); // Update user state
      } else {
        localStorage.removeItem('token'); // Remove invalid token
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
      localStorage.removeItem('token'); // Remove invalid token
    }
  };

  // Login function
  const loginUser = async (credentials) => {
    try {
      const data = await apiLogin(credentials); // Call the API login function
      localStorage.setItem('token', data.token); // Save the token to localStorage
      console.log('Token saved to localStorage:', data.token); // Log the token
      await fetchUserData(data.token); // Fetch user data
    } catch (error) {
      console.error('Login failed:', error);
      throw error; // Propagate the error to the caller
    }
  };

  // Logout function
  const logoutUser = () => {
    localStorage.removeItem('token'); // Remove the token
    setUser(null); // Clear the user state
  };

  return (
    <AuthContext.Provider value={{ user, login: loginUser, logout: logoutUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => React.useContext(AuthContext);