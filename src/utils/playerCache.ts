import { get, set } from 'idb-keyval';
import { getPlayersNBA } from '../api/main';

const PLAYERS_CACHE_KEY = 'sleeper_nba_players';
const PLAYERS_CACHE_TIMESTAMP_KEY = 'sleeper_nba_players_timestamp';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedPlayers {
  [playerId: string]: any;
}

/**
 * Check if cached players are still valid (less than 24 hours old)
 */
async function isCacheValid(): Promise<boolean> {
  try {
    const timestamp = await get<number>(PLAYERS_CACHE_TIMESTAMP_KEY);
    if (!timestamp) return false;
    const age = Date.now() - timestamp;
    return age < CACHE_DURATION_MS;
  } catch {
    return false;
  }
}

/**
 * Fetch and cache NBA players list
 * Only fetches from API if cache is expired or missing
 */
export async function getCachedPlayersNBA(): Promise<CachedPlayers | null> {
  try {
    // Check if cache is still valid
    const valid = await isCacheValid();
    if (valid) {
      console.log('Using cached NBA players');
      const cached = await get<CachedPlayers>(PLAYERS_CACHE_KEY);
      if (cached) return cached;
    }

    // Cache expired or missing, fetch from API
    console.log('Fetching NBA players from API...');
    const response = await getPlayersNBA();
    const players = response.data as CachedPlayers;

    // Store in cache
    await set(PLAYERS_CACHE_KEY, players);
    await set(PLAYERS_CACHE_TIMESTAMP_KEY, Date.now());

    console.log('NBA players cached successfully');
    return players;
  } catch (error) {
    console.error('Error fetching or caching NBA players:', error);
    // Try to return stale cache as fallback
    try {
      return await get<CachedPlayers>(PLAYERS_CACHE_KEY) || null;
    } catch {
      return null;
    }
  }
}

/**
 * Clear the player cache manually
 */
export async function clearPlayerCache(): Promise<void> {
  try {
    await set(PLAYERS_CACHE_KEY, {});
    await set(PLAYERS_CACHE_TIMESTAMP_KEY, 0);
    console.log('Player cache cleared');
  } catch (error) {
    console.error('Error clearing player cache:', error);
  }
}

/**
 * Get a single player by ID from cached data
 */
export async function getPlayerById(playerId: string): Promise<any | null> {
  const players = await getCachedPlayersNBA();
  return players ? players[playerId] ?? null : null;
}
