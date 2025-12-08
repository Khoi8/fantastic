import { useEffect } from 'react';
import { getCachedPlayersNBA } from '../utils/playerCache';

/**
 * Hook to initialize player cache on app load
 * Fetches NBA players list and caches for 24 hours
 */
export function useInitializePlayerCache() {
  useEffect(() => {
    const initialize = async () => {
      try {
        await getCachedPlayersNBA();
      } catch (error) {
        console.error('Failed to initialize player cache:', error);
      }
    };

    initialize();
  }, []);
}
