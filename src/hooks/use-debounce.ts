/**
 * Custom hook for debouncing values
 * Useful for search inputs, filtering, and other rapid-fire updates
 */

import { useState, useEffect } from 'react';

/**
 * Hook that debounces a value
 * The debounced value will only update after the specified delay
 *
 * @example
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearch = useDebounce(searchTerm, 500);
 *
 * useEffect(() => {
 *   // This will only run 500ms after the user stops typing
 *   fetchSearchResults(debouncedSearch);
 * }, [debouncedSearch]);
 *
 * <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up the timeout
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up the timeout if value changes before delay completes
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
