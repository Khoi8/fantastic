import { AllStats, PlayerZScores } from '../types/sleeper';

export type TrendStatus = 'BUY_LOW' | 'SELL_HIGH' | 'NEUTRAL' | 'BREAKOUT' | 'DECLINE';

export interface PlayerTrend {
  playerId: string;
  playerName: string;
  status: TrendStatus;
  seasonZ: number;
  recentZ: number;
  zDifference: number;
  confidenceScore: number; // 0-100, higher = more reliable trend
  reasoning: string;
}

export interface TrendAnalysis {
  trends: PlayerTrend[];
  buyLowCandidates: PlayerTrend[];
  sellHighCandidates: PlayerTrend[];
  breakouts: PlayerTrend[];
  declines: PlayerTrend[];
}

/**
 * Calculate trend indicators by comparing season vs recent performance
 * 
 * BUY_LOW: Player underperforming recently but strong season average
 * SELL_HIGH: Player overperforming recently but weak season average
 * BREAKOUT: Player improving consistently (recent > season)
 * DECLINE: Player declining consistently (recent < season)
 * NEUTRAL: No significant trend
 */
export const calculateTrends = (
  seasonZScores: PlayerZScores,
  recentZScores: PlayerZScores,
  seasonStats: AllStats,
  recentStats: AllStats
): TrendAnalysis => {
  const trends: PlayerTrend[] = [];

  Object.keys(seasonZScores).forEach((playerId) => {
    const seasonZ = seasonZScores[playerId];
    const recentZ = recentZScores[playerId];

    if (!seasonZ || !recentZ) return;

    const seasonTotalZ = seasonZ.totalZ;
    const recentTotalZ = recentZ.totalZ;
    const zDifference = recentTotalZ - seasonTotalZ;

    // Confidence scoring: based on recent games played
    // More games = more reliable recent performance
    const recentGP = recentStats[playerId]?.gp || 0;
    const seasonGP = seasonStats[playerId]?.gp || 0;
    
    // Recent confidence: higher if recent games are substantial portion of season
    const recentConfidence = Math.min(100, (recentGP / Math.max(seasonGP, 1)) * 100);
    
    // Magnitude confidence: higher if z-score difference is significant
    const magnitudeConfidence = Math.min(100, Math.abs(zDifference) * 10);
    
    // Combined confidence score
    const confidenceScore = (recentConfidence * 0.6 + magnitudeConfidence * 0.4);

    // Determine trend status
    let status: TrendStatus = 'NEUTRAL';
    let reasoning = '';

    // Thresholds for trend detection
    const BUY_LOW_THRESHOLD = -1.5;
    const SELL_HIGH_THRESHOLD = 1.5;

    if (seasonTotalZ > 0.5 && zDifference < BUY_LOW_THRESHOLD) {
      // Good season performance but recently struggling
      status = 'BUY_LOW';
      reasoning = `Season Z: ${seasonTotalZ.toFixed(2)}, Recent Z: ${recentTotalZ.toFixed(2)} - Underperforming recently`;
    } else if (seasonTotalZ < -0.5 && zDifference > SELL_HIGH_THRESHOLD) {
      // Poor season performance but recently hot
      status = 'SELL_HIGH';
      reasoning = `Season Z: ${seasonTotalZ.toFixed(2)}, Recent Z: ${recentTotalZ.toFixed(2)} - Overperforming recently`;
    } else if (recentTotalZ > seasonTotalZ + 1.0 && seasonTotalZ < 0.5) {
      // Breaking out from mediocrity/negative
      status = 'BREAKOUT';
      reasoning = `Trending up significantly - Recent Z: ${recentTotalZ.toFixed(2)}`;
    } else if (recentTotalZ < seasonTotalZ - 1.0 && seasonTotalZ > 0.5) {
      // Declining from strength
      status = 'DECLINE';
      reasoning = `Trending down from strength - Recent Z: ${recentTotalZ.toFixed(2)}`;
    }

    trends.push({
      playerId,
      playerName: seasonZ.name,
      status,
      seasonZ: parseFloat(seasonTotalZ.toFixed(2)),
      recentZ: parseFloat(recentTotalZ.toFixed(2)),
      zDifference: parseFloat(zDifference.toFixed(2)),
      confidenceScore: parseFloat(confidenceScore.toFixed(1)),
      reasoning,
    });
  });

  // Filter by status
  const buyLowCandidates = trends
    .filter((t) => t.status === 'BUY_LOW')
    .sort((a, b) => b.confidenceScore - a.confidenceScore);

  const sellHighCandidates = trends
    .filter((t) => t.status === 'SELL_HIGH')
    .sort((a, b) => b.confidenceScore - a.confidenceScore);

  const breakouts = trends
    .filter((t) => t.status === 'BREAKOUT')
    .sort((a, b) => b.recentZ - a.recentZ);

  const declines = trends
    .filter((t) => t.status === 'DECLINE')
    .sort((a, b) => a.recentZ - b.recentZ);

  return {
    trends,
    buyLowCandidates,
    sellHighCandidates,
    breakouts,
    declines,
  };
};

/**
 * Get color for trend status
 */
export const getTrendColor = (status: TrendStatus): string => {
  switch (status) {
    case 'BUY_LOW':
      return '#4caf50'; // Green - buying opportunity
    case 'SELL_HIGH':
      return '#f44336'; // Red - sell
    case 'BREAKOUT':
      return '#2196f3'; // Blue - momentum
    case 'DECLINE':
      return '#ff9800'; // Orange - warning
    case 'NEUTRAL':
    default:
      return '#999999'; // Gray
  }
};

/**
 * Get emoji for trend status
 */
export const getTrendEmoji = (status: TrendStatus): string => {
  switch (status) {
    case 'BUY_LOW':
      return '📈'; // Chart up
    case 'SELL_HIGH':
      return '📉'; // Chart down
    case 'BREAKOUT':
      return '🚀'; // Rocket
    case 'DECLINE':
      return '⚠️'; // Warning
    case 'NEUTRAL':
    default:
      return '➡️'; // Arrow right
  }
};

/**
 * Format trend for display
 */
export const formatTrendStatus = (status: TrendStatus): string => {
  const map: { [key in TrendStatus]: string } = {
    BUY_LOW: 'Buy Low',
    SELL_HIGH: 'Sell High',
    BREAKOUT: 'Breakout',
    DECLINE: 'Decline',
    NEUTRAL: 'Neutral',
  };
  return map[status];
};
