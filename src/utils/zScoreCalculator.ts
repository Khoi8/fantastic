import { mean, std } from 'mathjs';
import { AllStats, PlayerZScore, PlayerZScores, Roster, ScoringSettings } from '../types/sleeper';

// --- CONFIGURATION ---

const SETTINGS_TO_STATS_MAP: { [key: string]: string } = {
  pts: 'pts',
  reb: 'reb',
  ast: 'ast',
  st: 'stl',
  stl: 'stl',
  blk: 'blk',
  to: 'to',
  turnovers: 'to',
  fg3m: 'fg3m',
  tpm: 'fg3m',
  // Percentages need special mapping
  fg_pct: 'calculated_fg',
  ft_pct: 'calculated_ft',
  fg3_pct: 'calculated_3pt', // Added support for 3PT%
  // Ratios
  ast_to: 'ast_to' // Added support for A/T Ratio
};

// Stats that are already ratios/averages and SHOULD NOT be divided by GP
const PURE_RATIO_STATS = ['ast_to', 'stl_to']; 

// Stats that require "Weighted Impact" calculation (Volume based)
const IMPACT_STATS = ['calculated_fg', 'calculated_ft', 'calculated_3pt'];

const IGNORED_KEYS = [
  'bonus_ast_15p', 'bonus_pt_40p', 'bonus_pt_50p', 
  'bonus_reb_20p', 'qd'
];

/**
 * Helper: Get components for % stats (Made/Attempted) safely
 */
const getSplitStats = (player: any, type: 'fg' | 'ft' | '3pt') => {
  if (type === 'fg') return { m: Number(player.fgm || 0), a: Number(player.fga || 0) };
  if (type === 'ft') return { m: Number(player.ftm || 0), a: Number(player.fta || 0) };
  if (type === '3pt') return { m: Number(player.fg3m || 0), a: Number(player.fg3a || 0) }; // 3PT Handling
  return { m: 0, a: 0 };
};

export const calculateZScores = (
  leagueRosters: Roster[],
  allStats: AllStats,
  scoringSettings: ScoringSettings
): PlayerZScores => {
  
  // 1. Identify Active Categories
  const activeCats = Object.keys(scoringSettings)
    .filter(key => scoringSettings[key] !== 0 && !IGNORED_KEYS.includes(key)) 
    .map(settingKey => ({
      settingKey,
      statKey: SETTINGS_TO_STATS_MAP[settingKey] || settingKey,
      weight: Number(scoringSettings[settingKey]) // Ensure number
    }))
    .filter(cat => cat.statKey);

  if (activeCats.length === 0) return {};

  // 2. Build Population
  let populationIds: string[] = [];
  leagueRosters.forEach(roster => {
    if (roster.players) populationIds.push(...roster.players);
  });

  // 3. Extract Stats
  const populationStats = populationIds
    .map(id => allStats[id])
    .filter(stat => stat !== undefined && Number(stat.gp) > 0);

  if (populationStats.length === 0) return {};

  // 4. Calculate League Baselines
  const leagueMath: { [key: string]: { avg: number; std: number; avgPct?: number } } = {};

  activeCats.forEach(cat => {
    let values: number[] = [];
    let leagueAvgPct = 0;

    // A. HANDLE IMPACT STATS (FG%, FT%, 3PT%)
    if (IMPACT_STATS.includes(cat.statKey)) {
      const type = cat.statKey === 'calculated_fg' ? 'fg' : 
                   cat.statKey === 'calculated_ft' ? 'ft' : '3pt';

      let totalM = 0;
      let totalA = 0;
      
      populationStats.forEach(p => {
        const { m, a } = getSplitStats(p, type);
        totalM += m;
        totalA += a;
      });

      leagueAvgPct = totalA > 0 ? totalM / totalA : 0;

      values = populationStats.map(p => {
        const { m, a } = getSplitStats(p, type);
        const gp = Number(p.gp);
        const pgMade = m / gp;
        const pgAtt = a / gp;
        return pgMade - (pgAtt * leagueAvgPct);
      });

    } else {
      // B. HANDLE STANDARD STATS
      values = populationStats.map(p => {
        const rawVal = Number(p[cat.statKey] || 0);
        
        // If it's a Pure Ratio (e.g. A/T), use raw value. 
        // If it's a Counting Stat (Pts), divide by GP.
        if (PURE_RATIO_STATS.includes(cat.statKey)) {
          return rawVal;
        }
        return rawVal / Number(p.gp);
      });
    }

    const stdDev = Number(std(values));
    leagueMath[cat.settingKey] = {
      avg: Number(mean(values)),
      std: stdDev === 0 ? 1 : stdDev,
      avgPct: leagueAvgPct
    };
  });

  // 5. Calculate Z-Scores
  const result: PlayerZScores = {};

  populationIds.forEach(id => {
    const pStats = allStats[id];
    if (!pStats || !pStats.gp) return;

    const name = (pStats as any).player_name || 'Unknown Player';

    const playerEntry: PlayerZScore = {
      name,
      scores: {},
      totalZ: 0
    };

    let totalZ = 0;

    activeCats.forEach(cat => {
      const math = leagueMath[cat.settingKey];
      let val = 0;
      const gp = Number(pStats.gp);

      // A. IMPACT CALCULATION
      if (IMPACT_STATS.includes(cat.statKey)) {
        const type = cat.statKey === 'calculated_fg' ? 'fg' : 
                     cat.statKey === 'calculated_ft' ? 'ft' : '3pt';
        const { m, a } = getSplitStats(pStats, type);
        
        const pgMade = m / gp;
        const pgAtt = a / gp;
        val = pgMade - (pgAtt * (math.avgPct || 0)); 

      } else {
        // B. STANDARD CALCULATION
        const rawVal = Number(pStats[cat.statKey] || 0);
        
        if (PURE_RATIO_STATS.includes(cat.statKey)) {
          val = rawVal;
        } else {
          val = rawVal / gp;
        }
      }

      // RAW Z-SCORE
      let z = (val - math.avg) / math.std;

      // WEIGHT APPLICATION (Direction AND Magnitude)
      // 1. Flip sign if weight is negative (Turnovers)
      if (cat.weight < 0) {
        z = z * -1;
      }
      
      // 2. Apply Magnitude (e.g., if Points are worth 2x)
      //    We use absolute value because we already handled the sign above
      z = z * Math.abs(cat.weight);

      playerEntry.scores[cat.settingKey] = parseFloat(z.toFixed(2));
      totalZ += z;
    });

    playerEntry.totalZ = parseFloat(totalZ.toFixed(2));
    result[id] = playerEntry;
  });

  return result;
};