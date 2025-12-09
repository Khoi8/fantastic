import { get, set } from 'idb-keyval';

const INJURIES_CACHE_KEY = 'sleeper_nba_injuries';
const INJURIES_CACHE_TIMESTAMP_KEY = 'sleeper_nba_injuries_timestamp';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface InjuryData {
  [playerId: string]: any;
}

/**
 * Check if cached injuries are still valid (less than 24 hours old)
 */
async function isCacheValid(): Promise<boolean> {
  try {
    const timestamp = await get<number>(INJURIES_CACHE_TIMESTAMP_KEY);
    if (!timestamp) return false;
    const age = Date.now() - timestamp;
    return age < CACHE_DURATION_MS;
  } catch {
    return false;
  }
}

/**
 * Fetch player injuries from Sleeper API and cache them
 * Includes injury status, injury details, and other player metadata
 */
export async function getCachedPlayerInjuries(): Promise<InjuryData | null> {
  try {
    // Check if cache is still valid
    const valid = await isCacheValid();
    if (valid) {
      console.log('Using cached player injuries');
      const cached = await get<InjuryData>(INJURIES_CACHE_KEY);
      if (cached) return cached;
    }

    // Cache expired or missing, fetch from API
    console.log('Fetching player injuries from Sleeper API...');
    const response = await fetch('https://api.sleeper.app/v1/players/nba');
    
    if (!response.ok) {
      console.error('Failed to fetch injuries:', response.statusText);
      return null;
    }

    const allPlayers = (await response.json()) as InjuryData;

    // Store in cache
    await set(INJURIES_CACHE_KEY, allPlayers);
    await set(INJURIES_CACHE_TIMESTAMP_KEY, Date.now());

    console.log('Player injuries cached successfully');
    return allPlayers;
  } catch (error) {
    console.error('Error fetching player injuries:', error);
    return null;
  }
}

/**
 * Get injury status for a specific player
 */
export const getPlayerInjuryStatus = (playerData: any): string | null => {
  if (!playerData) return null;
  
  // Check for injury_status field
  if (playerData.injury_status) {
    return playerData.injury_status;
  }
  
  // Check for active/inactive status
  if (playerData.active === false) {
    return 'Inactive';
  }
  
  // Check for injury start date
  if (playerData.injury_start_date) {
    return 'Injured';
  }
  
  return null;
};

/**
 * Get injury details for a specific player
 */
export const getPlayerInjuryDetails = (playerData: any): { status: string; details: string } | null => {
  if (!playerData) return null;

  const status = getPlayerInjuryStatus(playerData);
  
  if (!status) {
    return null;
  }

  const details = playerData.injury || playerData.injury_details || 'No details available';

  return {
    status,
    details,
  };
};
