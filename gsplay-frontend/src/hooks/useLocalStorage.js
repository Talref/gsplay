import { useState, useEffect } from 'react';

/**
 * Custom hook for localStorage with state synchronization
 * @param {string} key - The localStorage key
 * @param {*} defaultValue - Default value if key doesn't exist
 * @returns {[any, function]} [currentValue, setterFunction]
 */
export const useLocalStorage = (key, defaultValue) => {
  // Get initial value from localStorage
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      // Handle both JSON and plain strings for backward compatibility
      return item !== null ? JSON.parse(item) : defaultValue;
    } catch (error) {
      // If JSON parse fails, treat as plain string
      console.warn(`Error parsing localStorage key "${key}":`, error);
      const item = window.localStorage.getItem(key);
      return item !== null ? item : defaultValue;
    }
  });

  // Update localStorage when state changes
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.warn(`Error storing localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
};
