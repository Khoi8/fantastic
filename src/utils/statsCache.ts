import { get, set } from 'idb-keyval';
import { getNBAStats } from '../api/main';

const STATS_CACHE_KEY = 'sleeper_nba_stats';
const STATS_CACHE_TIMESTAMP_KEY = 'sleeper_nba_stats_timestamp';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface NBAStats {
  [playerId: string]: any;
}

/**
 * Check if cached stats are still valid (less than 24 hours old)
 */
async function isCacheValid(): Promise<boolean> {
  try {
    const timestamp = await get<number>(STATS_CACHE_TIMESTAMP_KEY);
    if (!timestamp) return false;
    const age = Date.now() - timestamp;
    return age < CACHE_DURATION_MS;
  } catch {
    return false;
  }
}

/**
 * Fetch and cache NBA stats for a season
 * Only fetches from API if cache is expired or missing
 */
export async function getCachedNBAStats(season = '2025', seasonType = 'regular'): Promise<NBAStats | null> {
  try {
    // Check if cache is still valid
    const valid = await isCacheValid();
    if (valid) {
      console.log('Using cached NBA stats');
      const cached = await get<NBAStats>(STATS_CACHE_KEY);
      if (cached) return cached;
    }

    // Cache expired or missing, fetch from API
    console.log('Fetching NBA stats from API...');
    const response = await getNBAStats(season, seasonType);
    const stats = response.data as NBAStats;

    // Store in cache
    await set(STATS_CACHE_KEY, stats);
    await set(STATS_CACHE_TIMESTAMP_KEY, Date.now());

    console.log('NBA stats cached successfully');
    return stats;
  } catch (error) {
    console.error('Error fetching or caching NBA stats:', error);
    // Try to return stale cache as fallback
    try {
      return await get<NBAStats>(STATS_CACHE_KEY) || null;
    } catch {
      return null;
    }
  }
}

/**
 * Clear the stats cache manually
 */
export async function clearStatsCache(): Promise<void> {
  try {
    await set(STATS_CACHE_KEY, {});
    await set(STATS_CACHE_TIMESTAMP_KEY, 0);
    console.log('Stats cache cleared');
  } catch (error) {
    console.error('Error clearing stats cache:', error);
  }
}

/**
 * Get stats for a specific player by ID
 */
export async function getPlayerStats(playerId: string): Promise<any | null> {
  const stats = await getCachedNBAStats();
  return stats ? stats[playerId] ?? null : null;
}
