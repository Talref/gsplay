//src/context/authContext.js
import React, { createContext, useState, useEffect, useCallback } from 'react';
import { login as apiLogin, logout as apiLogout, fetchMe } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Add loading state

  const fetchUserData = useCallback(async () => {
    setLoading(true); // Start loading
    try {
      const response = await fetch('/api/users/me', {
        credentials: 'include',
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('User fetch error:', error);
      setUser(null);
    } finally {
      setLoading(false); // End loading
    }
  }, []);

  // Handle token refresh response
  const handleTokenRefresh = useCallback((refreshResponse) => {
    if (refreshResponse && refreshResponse.user) {
      setUser(refreshResponse.user);
    }
  }, []);

  // Proactive token refresh every 10 minutes (before 15min expiry)
  useEffect(() => {
    if (!user) return;

    const refreshInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/refresh-token', {
          method: 'POST',
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          handleTokenRefresh(data);
        }
      } catch (error) {
        console.error('Proactive refresh failed:', error);
      }
    }, 10 * 60 * 1000); // 10 minutes

    return () => clearInterval(refreshInterval);
  }, [user, handleTokenRefresh]);

  // Listen for token refresh events
  useEffect(() => {
    const handleTokenRefreshed = (event) => {
      handleTokenRefresh(event.detail);
    };

    const handleTokenRefreshFailed = () => {
      setUser(null);
    };

    window.addEventListener('tokenRefreshed', handleTokenRefreshed);
    window.addEventListener('tokenRefreshFailed', handleTokenRefreshFailed);

    return () => {
      window.removeEventListener('tokenRefreshed', handleTokenRefreshed);
      window.removeEventListener('tokenRefreshFailed', handleTokenRefreshFailed);
    };
  }, [handleTokenRefresh]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // Login function
  const loginUser = async (credentials) => {
    try {
      // The login endpoint now returns the user data directly.
      const response = await apiLogin(credentials);
      setUser(response.user);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  // Logout function
  const logoutUser = async () => {
    try {
      await apiLogout();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login: loginUser, logout: logoutUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => React.useContext(AuthContext);
