import { get, set } from 'idb-keyval';
import { AllStats } from '../types/sleeper';

const RECENT_STATS_CACHE_KEY = 'sleeper_nba_recent_stats';
const RECENT_STATS_CACHE_TIMESTAMP_KEY = 'sleeper_nba_recent_stats_timestamp';
const CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours (more frequent updates for recent stats)

interface SleeperState {
  week: number;
  season: string;
  season_type: string;
}

/**
 * Check if cached recent stats are still valid
 */
async function isCacheValid(): Promise<boolean> {
  try {
    const timestamp = await get<number>(RECENT_STATS_CACHE_TIMESTAMP_KEY);
    if (!timestamp) return false;
    const age = Date.now() - timestamp;
    return age < CACHE_DURATION_MS;
  } catch {
    return false;
  }
}

/**
 * Fetch the last 2 weeks (approx 14 days) of stats for all NBA players
 */
export const fetchLast14DaysStats = async (): Promise<AllStats> => {
  try {
    // 1. Get the current state of the NBA season
    const stateRes = await fetch('https://api.sleeper.app/v1/state/nba');
    const state: SleeperState = await stateRes.json();

    const currentWeek = state.week;
    // If it's Week 1, just use Week 1. Otherwise use Current + Previous.
    const weeksToFetch = currentWeek > 1 ? [currentWeek, currentWeek - 1] : [currentWeek];

    console.log(`Fetching recent stats for weeks: ${weeksToFetch.join(', ')}...`);

    // 2. Fetch stats for those weeks in parallel
    const requests = weeksToFetch.map((week) =>
      fetch(`https://api.sleeper.app/v1/stats/nba/regular/${state.season}/${week}`).then((res) =>
        res.json()
      )
    );

    const weeklyData = await Promise.all(requests);
    const mergedStats: AllStats = {};

    // 3. Merge the data
    weeklyData.forEach((weekStats: any) => {
      Object.keys(weekStats).forEach((playerId) => {
        const pData = weekStats[playerId];

        // Initialize if not exists
        if (!mergedStats[playerId]) {
          mergedStats[playerId] = {
            gp: 0,
            player_name: '',
            pts: 0,
            reb: 0,
            ast: 0,
            stl: 0,
            blk: 0,
            to: 0,
            fgm: 0,
            fga: 0,
            ftm: 0,
            fta: 0,
            fg3m: 0,
            fg3a: 0,
            tf: 0,
          };
        }

        // Sum up the specific stats
        const target = mergedStats[playerId];

        target.gp += pData.gp || 0;
        target.pts = (Number(target.pts) || 0) + (pData.pts || 0);
        target.reb = (Number(target.reb) || 0) + (pData.reb || 0);
        target.ast = (Number(target.ast) || 0) + (pData.ast || 0);
        target.stl = (Number(target.stl) || 0) + (pData.stl || 0);
        target.blk = (Number(target.blk) || 0) + (pData.blk || 0);
        target.to = (Number(target.to) || 0) + (pData.to || 0);

        // Percentages Components
        target.fgm = (Number(target.fgm) || 0) + (pData.fgm || 0);
        target.fga = (Number(target.fga) || 0) + (pData.fga || 0);
        target.ftm = (Number(target.ftm) || 0) + (pData.ftm || 0);
        target.fta = (Number(target.fta) || 0) + (pData.fta || 0);
        target.fg3m = (Number(target.fg3m) || 0) + (pData.fg3m || 0);
        target.fg3a = (Number(target.fg3a) || 0) + (pData.fg3a || 0);

        // Add rare stats if tracked
        if (pData.tf) target.tf = (Number(target.tf) || 0) + (pData.tf || 0);
      });
    });

    return mergedStats;
  } catch (error) {
    console.error('Error fetching recent stats:', error);
    return {};
  }
};

/**
 * Get cached recent stats with 6-hour TTL
 */
export async function getCachedRecentStats(): Promise<AllStats | null> {
  try {
    // Check if cache is still valid
    const valid = await isCacheValid();
    if (valid) {
      console.log('Using cached recent stats (6 hours)');
      const cached = await get<AllStats>(RECENT_STATS_CACHE_KEY);
      if (cached) return cached;
    }

    // Cache expired or missing, fetch fresh data
    console.log('Fetching fresh recent stats...');
    const stats = await fetchLast14DaysStats();

    // Store in cache
    await set(RECENT_STATS_CACHE_KEY, stats);
    await set(RECENT_STATS_CACHE_TIMESTAMP_KEY, Date.now());

    console.log('Recent stats cached successfully');
    return stats;
  } catch (error) {
    console.error('Error getting cached recent stats:', error);
    return null;
  }
}

/**
 * Clear recent stats cache (useful for manual refresh)
 */
export async function clearRecentStatsCache(): Promise<void> {
  try {
    await set(RECENT_STATS_CACHE_TIMESTAMP_KEY, 0);
    console.log('Recent stats cache cleared');
  } catch (error) {
    console.error('Error clearing recent stats cache:', error);
  }
}
