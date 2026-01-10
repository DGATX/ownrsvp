/**
 * Custom hook for localStorage with type safety and SSR support
 * Extracts common localStorage patterns from config components
 */

import { useState, useEffect, useCallback } from 'react';
import { storage } from '@/lib/config-utils';

/**
 * Hook for using localStorage with React state
 * Automatically syncs with localStorage and handles SSR
 *
 * @example
 * const [email, setEmail] = useLocalStorage('test_email', 'default@example.com');
 *
 * // Update value (syncs to localStorage automatically)
 * setEmail('new@example.com');
 *
 * // Remove value
 * setEmail(null);
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | null) => void, () => void] {
  // Initialize state with value from localStorage or initial value
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = storage.get(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  // Update localStorage whenever state changes
  const setValue = useCallback(
    (value: T | null) => {
      try {
        if (value === null) {
          // Remove from localStorage
          storage.remove(key);
          setStoredValue(initialValue);
        } else {
          // Save to localStorage
          storage.setJSON(key, value);
          setStoredValue(value);
        }
      } catch (error) {
        // If localStorage is unavailable, just update state
        setStoredValue(value ?? initialValue);
      }
    },
    [key, initialValue]
  );

  // Clear the value (reset to initial)
  const clearValue = useCallback(() => {
    setValue(null);
  }, [setValue]);

  // Sync with localStorage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        try {
          setStoredValue(JSON.parse(e.newValue) as T);
        } catch (error) {
          // Ignore parse errors
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [storedValue, setValue, clearValue];
}
