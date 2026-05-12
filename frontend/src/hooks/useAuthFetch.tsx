import { useAuth } from '@clerk/clerk-react';
import { useCallback } from 'react';

export default function useAuthFetch() {
  const { getToken } = useAuth();
  return useCallback(async (url: string, options: RequestInit = {}) => {
    const token = await getToken();
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }, [getToken]);
}
