import { AllStats, PlayerStats } from '../types/sleeper'; // Your existing types

interface SleeperState {
  week: number;
  season: string;
  season_type: string;
}

/**
 * Fetches the last 2 weeks (approx 14 days) of stats for all NBA players.
 */
export const fetchLast14DaysStats = async (): Promise<AllStats> => {
  // 1. Get the current state of the NBA season (to find current week)
  const stateRes = await fetch('https://api.sleeper.app/v1/state/nba');
  const state: SleeperState = await stateRes.json();
  
  const currentWeek = state.week;
  // If it's Week 1, just use Week 1. Otherwise use Current + Previous.
  const weeksToFetch = currentWeek > 1 ? [currentWeek, currentWeek - 1] : [currentWeek];

  console.log(`Fetching stats for weeks: ${weeksToFetch.join(', ')}...`);

  // 2. Fetch stats for those weeks in parallel
  const requests = weeksToFetch.map(week => 
    fetch(`https://api.sleeper.app/v1/stats/nba/regular/${state.season}/${week}`)
      .then(res => res.json())
  );

  const weeklyData = await Promise.all(requests);
  const mergedStats: AllStats = {};

  // 3. Merge the data
  // weeklyData is an array of objects: [{ "playerId": { pts: 10, ... } }, { "playerId": { pts: 15, ... } }]
  weeklyData.forEach((weekStats: any) => {
    Object.keys(weekStats).forEach(playerId => {
      const pData = weekStats[playerId];

      // Initialize if not exists
      if (!mergedStats[playerId]) {
        mergedStats[playerId] = {
          gp: 0,
          player_name: '', // Sleeper stats endpoint doesn't usually send names, you map this later
          ...pData // Copy stricture
        };
        // Reset counters to 0 so we can sum cleanly
        ['pts', 'reb', 'ast', 'stl', 'blk', 'to', 'fgm', 'fga', 'ftm', 'fta', 'fg3m', 'fg3a'].forEach(cat => {
            mergedStats[playerId][cat] = 0;
        });
      }

      // Sum up the specific stats we care about
      const target = mergedStats[playerId];
      
      target.gp += (pData.gp || 0);
      target.pts = (Number(target.pts) || 0) + (pData.pts || 0);
      target.reb = (Number(target.reb) || 0) + (pData.reb || 0);
      target.ast = (Number(target.ast) || 0) + (pData.ast || 0);
      target.stl = (Number(target.stl) || 0) + (pData.stl || 0);
      target.blk = (Number(target.blk) || 0) + (pData.blk || 0);
      target.to  = (Number(target.to) || 0)  + (pData.to || 0);
      
      // Percentages Components
      target.fgm = (Number(target.fgm) || 0) + (pData.fgm || 0);
      target.fga = (Number(target.fga) || 0) + (pData.fga || 0);
      target.ftm = (Number(target.ftm) || 0) + (pData.ftm || 0);
      target.fta = (Number(target.fta) || 0) + (pData.fta || 0);
      target.fg3m = (Number(target.fg3m) || 0) + (pData.fg3m || 0);
      target.fg3a = (Number(target.fg3a) || 0) + (pData.fg3a || 0);
      
      // Add rare stats if you track them
      if (pData.tf) target.tf = (Number(target.tf) || 0) + (pData.tf || 0);
    });
  });

  return mergedStats;
};