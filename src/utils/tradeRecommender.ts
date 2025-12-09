import { Roster } from '../types/sleeper';

interface PlayerZScore {
  name: string;
  scores: { [key: string]: number };
  totalZ: number;
}

interface PlayerZScores {
  [playerId: string]: PlayerZScore;
}

interface TradeRecommendation {
  playerId: string;
  playerName: string;
  rosters: Roster[];
  rosterIndex: number;
  ownerName?: string;
  stats: {
    needCategoryZ: number;
    spareCategoryZ: number;
    tradeScore: number; // How good this trade is for you
  };
}

/**
 * Recommend trade partners and players based on category needs
 * @param myRosterId - Your roster ID
 * @param leagueRosters - All rosters in the league
 * @param playerZScores - Z-scores for all players
 * @param needCategory - Category you need (e.g., 'ast')
 * @param spareCategory - Category you can spare (e.g., 'blk')
 * @param ownerDisplayNames - Map of roster_id to owner names (optional)
 * @returns Array of recommended trade targets, sorted by trade score
 */
export const recommendTrades = (
  myRosterId: number,
  leagueRosters: Roster[],
  playerZScores: PlayerZScores,
  needCategory: string,
  spareCategory: string,
  ownerDisplayNames?: { [key: string]: string }
): TradeRecommendation[] => {
  const recommendations: TradeRecommendation[] = [];
  const myRoster = leagueRosters.find((r) => r.roster_id === myRosterId);

  if (!myRoster) return [];

  const myPlayerIds = new Set(myRoster.players || []);

  // Iterate through all other rosters
  leagueRosters.forEach((roster, rosterIndex) => {
    if (roster.roster_id === myRosterId) return; // Skip own roster

    // Look at each player in the other roster
    (roster.players || []).forEach((playerId) => {
      const playerData = playerZScores[playerId];
      if (!playerData) return;

      const needCategoryZ = playerData.scores[needCategory] ?? 0;
      const spareCategoryZ = playerData.scores[spareCategory] ?? 0;

      // Trade score: How good would it be to get this player?
      // High in what we need + low in what we spare = good trade for us
      const tradeScore = needCategoryZ - spareCategoryZ;

      recommendations.push({
        playerId,
        playerName: playerData.name,
        rosters: leagueRosters,
        rosterIndex,
        ownerName: ownerDisplayNames?.[String(roster.roster_id)] || `Team ${roster.roster_id}`,
        stats: {
          needCategoryZ,
          spareCategoryZ,
          tradeScore,
        },
      });
    });
  });

  // Sort by trade score (descending) - best trades first
  recommendations.sort((a, b) => b.stats.tradeScore - a.stats.tradeScore);

  return recommendations;
};
