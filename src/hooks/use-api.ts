/**
 * Custom hook for API calls with loading and error states
 * Reduces boilerplate in components making API requests
 */

import { useState, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';

interface UseApiOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  successMessage?: string;
  errorMessage?: string;
}

interface UseApiReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  execute: (...args: unknown[]) => Promise<T | null>;
  reset: () => void;
}

/**
 * Hook for making API calls with automatic loading and error handling
 *
 * @example
 * const { loading, execute } = useApi(async (id: string) => {
 *   const res = await fetch(`/api/events/${id}`);
 *   return res.json();
 * }, {
 *   successMessage: 'Event loaded!',
 *   onSuccess: (data) => console.log(data),
 * });
 *
 * // In component
 * <Button onClick={() => execute(eventId)} disabled={loading}>
 *   {loading ? 'Loading...' : 'Load Event'}
 * </Button>
 */
export function useApi<T>(
  apiFunction: (...args: unknown[]) => Promise<T>,
  options: UseApiOptions<T> = {}
): UseApiReturn<T> {
  const { toast } = useToast();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (...args: unknown[]) => {
      try {
        setLoading(true);
        setError(null);

        const result = await apiFunction(...args);
        setData(result);

        if (options.successMessage) {
          toast({
            title: 'Success',
            description: options.successMessage,
          });
        }

        options.onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('An error occurred');
        setError(error);

        if (options.errorMessage) {
          toast({
            title: 'Error',
            description: options.errorMessage,
            variant: 'destructive',
          });
        }

        options.onError?.(error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiFunction, options, toast]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset };
}
