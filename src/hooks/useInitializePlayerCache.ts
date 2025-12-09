import { useEffect } from 'react';
import { getCachedPlayersNBA } from '../utils/playerCache';
import { getCachedNBAStats } from '../utils/statsCache';

/**
 * Hook to initialize player cache and stats cache on app load
 * Fetches NBA players list and stats, caching both for 24 hours
 */
export function useInitializePlayerCache() {
  useEffect(() => {
    const initialize = async () => {
      try {
        await Promise.all([
          getCachedPlayersNBA(),
          getCachedNBAStats(),
        ]);
      } catch (error) {
        console.error('Failed to initialize caches:', error);
      }
    };

    initialize();
  }, []);
}
