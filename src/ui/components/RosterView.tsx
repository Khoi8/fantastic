import React, { useEffect, useState } from 'react';
import { getCachedPlayersNBA } from '../../utils/playerCache';
import { getCachedNBAStats } from '../../utils/statsCache';
import { calculateZScores } from '../../utils/zScoreCalculator';
import { getCachedPlayerInjuries, getPlayerInjuryDetails } from '../../utils/injuryCache';
import { getCachedRecentStats } from '../../utils/recentStatsCache';
import { calculateTrends, getTrendColor, getTrendEmoji, formatTrendStatus } from '../../utils/trendAnalysis';
import { ZScoreRadar } from './ZScoreRadar';

// Map stat abbreviations to full English names
const STAT_NAMES: { [key: string]: string } = {
  pts: 'Points',
  reb: 'Rebounds',
  ast: 'Assists',
  st: 'Steals',
  stl: 'Steals',
  blk: 'Blocks',
  to: 'Turnovers',
  turnovers: 'Turnovers',
  fg3m: '3-Pointers Made',
  tpm: '3-Pointers Made',
  fg_pct: 'Field Goal %',
  ft_pct: 'Free Throw %',
  dd: 'Double Doubles',
  td: 'Triple Doubles',
  tf: 'Technical Fouls',
  ff: 'Flagrant Fouls',
  bonus_ast_15p: 'Assist Bonus (15+)',
  bonus_pt_40p: 'Points Bonus (40+)',
  bonus_pt_50p: 'Points Bonus (50+)',
  bonus_reb_20p: 'Rebound Bonus (20+)',
};

interface RosterViewProps {
  roster: any;
  allRosters?: any[];
  scoringSettings?: any;
}

const RosterView: React.FC<RosterViewProps> = ({ roster, allRosters, scoringSettings }) => {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [playerZScores, setPlayerZScores] = useState<{ [playerId: string]: any }>({});
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [playerInjuries, setPlayerInjuries] = useState<{ [playerId: string]: any }>({});
  const [playerTrends, setPlayerTrends] = useState<{ [playerId: string]: any }>({});

  useEffect(() => {
    const loadPlayers = async () => {
      try {
        const playersMap = await getCachedPlayersNBA();
        if (!playersMap || !roster.players) {
          setPlayers([]);
          return;
        }

        // Debug: log players map and roster
        console.log('Players Map Keys:', Object.keys(playersMap).length);
        console.log('Roster Player IDs:', roster.players);

        // Map roster player IDs to player objects
        const playerList = (roster.players as string[])
          .map((playerId) => {
            const player = playersMap[playerId];
            if (!player) {
              console.warn(`Player ID ${playerId} not found in player map`);
            }
            return {
              id: playerId,
              name: player?.first_name && player?.last_name 
                ? `${player.first_name} ${player.last_name}`
                : player?.search_full_name || playerId,
              position: player?.position || 'N/A',
              team: player?.team || 'N/A',
              number: player?.number || '-',
            };
          });

        console.log('Processed Player List:', playerList);
        setPlayers(playerList);

        // Calculate z-scores if we have all rosters and scoring settings
        if (allRosters && allRosters.length > 0 && scoringSettings) {
          try {
            const stats = await getCachedNBAStats();
            console.log('Cached NBA Stats:', stats);
            console.log('All Rosters:', allRosters);
            console.log('Scoring Settings:', scoringSettings);
            if (stats) {
              const zScores = calculateZScores(allRosters, stats, scoringSettings);
              
              // Enrich z-scores with proper player names from playersMap
              Object.entries(zScores).forEach(([playerId, playerData]) => {
                const playerInfo = playersMap[playerId];
                if (playerInfo && playerInfo.first_name && playerInfo.last_name) {
                  playerData.name = `${playerInfo.first_name} ${playerInfo.last_name}`;
                }
              });
              
              setPlayerZScores(zScores);

              // Fetch player injury data
              const injuriesData = await getCachedPlayerInjuries();
              if (injuriesData) {
                const injuryMap: { [playerId: string]: any } = {};
                Object.entries(injuriesData).forEach(([playerId, playerData]: [string, any]) => {
                  const injuryDetails = getPlayerInjuryDetails(playerData);
                  if (injuryDetails) {
                    injuryMap[playerId] = injuryDetails;
                  }
                });
                setPlayerInjuries(injuryMap);
              }

              // Fetch recent stats and calculate trends
              try {
                const recentStats = await getCachedRecentStats();
                console.log('Cached Recent Stats:', recentStats);
                if (recentStats) {
                  const recentZScores = calculateZScores(allRosters, recentStats, scoringSettings);
                  console.log('Recent Z-Scores:', recentZScores);

                  // Calculate trends comparing season to recent
                  const trends = calculateTrends(zScores, recentZScores, stats, recentStats);
                  console.log('Calculated Trends:', trends);

                  // Build trend map for quick lookup
                  const trendMap: { [playerId: string]: any } = {};
                  trends.trends.forEach((trend) => {
                    trendMap[trend.playerId] = trend;
                  });
                  setPlayerTrends(trendMap);
                }
              } catch (trendError) {
                console.warn('Error calculating trends:', trendError);
                // Trends are optional, don't fail if they don't load
              }
            }
          } catch (error) {
            // Silently fail
          }
        }
      } catch (error) {
        setPlayers([]);
      } finally {
        setLoading(false);
      }
    };

    loadPlayers();
  }, [roster, allRosters, scoringSettings]);

  if (loading) return <div style={{ fontSize: 12, color: '#999' }}>Loading players...</div>;

  // Calculate bench players (all players not in starters)
  const starterIds = new Set(roster.starters ?? []);
  const benchPlayers = players.filter((p) => !starterIds.has(p.id));

  // Helper function to get background color based on z-score
  const getRowColor = (playerId: string): string => {
    const zScore = playerZScores[playerId]?.totalZ;
    if (zScore === undefined || zScore === null) return 'white';
    if (zScore > 0.1) return '#e8f5e9'; // Light green for positive
    if (zScore < -0.1) return '#ffebee'; // Light red for negative
    return 'white'; // White for neutral
  };

  // Helper to determine category color based on z-score thresholds
  const getCategoryColor = (score: number): string => {
    if (score > 12.0) return '#00ff00'; // Neon Green - SELL
    if (score >= 5.0) return '#4caf50'; // Green - HOLD
    if (score >= -1.0 && score <= 1.0) return '#999999'; // Gray - FIGHT FOR IT
    if (score < -5.0) return '#8b0000'; // Deep Red - PUNT IT
    // -5.0 to -1.0: intermediate red
    return '#f44336'; // Red
  };

  // Helper to render player row with z-score
  const renderPlayerRow = (playerId: string, isStarter: boolean) => {
    const player = players.find((p) => p.id === playerId);
    const zScore = playerZScores[playerId]?.totalZ ?? 'N/A';
    const bgColor = getRowColor(playerId);
    const isExpanded = expandedPlayerId === playerId;
    const confidence = playerZScores[playerId]?.confidence;
    const gp = playerZScores[playerId]?.gp;

    // Color for confidence badge
    const getConfidenceColor = (conf: string) => {
      switch (conf) {
        case 'HIGH':
          return '#4caf50'; // Green
        case 'MEDIUM':
          return '#ff9800'; // Orange
        case 'LOW_SAMPLE':
          return '#f44336'; // Red
        default:
          return '#999999';
      }
    };

    return (
      <div key={playerId}>
        <div
          onClick={() => setExpandedPlayerId(isExpanded ? null : playerId)}
          style={{
            padding: '4px 6px',
            background: bgColor,
            borderRadius: 4,
            fontSize: 11,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            border: `1px solid ${isStarter ? '#ddd' : '#eee'}`,
            cursor: 'pointer',
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>{player?.name || playerId}</span>
              {playerInjuries[playerId] && (
                <div
                  style={{
                    padding: '2px 6px',
                    background: '#f44336',
                    color: 'white',
                    borderRadius: 3,
                    fontSize: 8,
                    fontWeight: 600,
                  }}
                  title={playerInjuries[playerId].details}
                >
                  {playerInjuries[playerId].status}
                </div>
              )}
              {playerTrends[playerId] && (
                <div
                  style={{
                    padding: '2px 6px',
                    background: getTrendColor(playerTrends[playerId].status),
                    color: 'white',
                    borderRadius: 3,
                    fontSize: 8,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                  }}
                  title={playerTrends[playerId].reasoning}
                >
                  {getTrendEmoji(playerTrends[playerId].status)} {formatTrendStatus(playerTrends[playerId].status)}
                </div>
              )}
            </div>
            <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>
              {player?.position} ({player?.team})
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {confidence && (
              <div
                style={{
                  padding: '2px 6px',
                  background: getConfidenceColor(confidence),
                  color: 'white',
                  borderRadius: 3,
                  fontSize: 9,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {confidence === 'LOW_SAMPLE' ? `${gp}GP` : confidence === 'MEDIUM' ? `${gp}GP` : `${gp}GP`}
              </div>
            )}
            <div style={{ minWidth: 50, textAlign: 'right', fontWeight: 600, fontSize: 12 }}>
              {typeof zScore === 'number' ? zScore.toFixed(2) : zScore}
            </div>
          </div>
        </div>

        {isExpanded && playerZScores[playerId] && (
          <div style={{ marginTop: 4, padding: '8px', background: '#f9f9f9', borderRadius: 4, fontSize: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 6, color: '#333' }}>Category Z-Scores:</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4, marginBottom: 8 }}>
              {Object.entries(playerZScores[playerId].scores).map(([cat, score]: [string, any]) => {
                const scoreNum = typeof score === 'number' ? score : 0;
                const catName = STAT_NAMES[cat] || cat;
                const scoreColor = Math.abs(scoreNum) < 1 ? '#999999' : scoreNum > 0 ? '#4caf50' : '#f44336';
                return (
                  <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 4px' }}>
                    <span style={{ fontWeight: 500 }}>{catName}:</span>
                    <span style={{ color: scoreColor, fontWeight: 600 }}>{scoreNum.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ marginBottom: 8 }}>
              <ZScoreRadar playerA={playerZScores[playerId]} height={220} />
            </div>

            {playerTrends[playerId] && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #ddd' }}>
                <div style={{ fontWeight: 600, marginBottom: 4, color: '#333' }}>Trend Analysis:</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                  <span style={{ fontWeight: 500 }}>Status:</span>
                  <span
                    style={{
                      padding: '2px 6px',
                      background: getTrendColor(playerTrends[playerId].status),
                      color: 'white',
                      borderRadius: 3,
                      fontSize: 9,
                      fontWeight: 600,
                    }}
                  >
                    {getTrendEmoji(playerTrends[playerId].status)} {formatTrendStatus(playerTrends[playerId].status)}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
                  <div>
                    <span style={{ fontWeight: 500, fontSize: 9 }}>Season Z:</span>
                    <div style={{ color: '#2196F3', fontWeight: 600 }}>{playerTrends[playerId].seasonZ.toFixed(2)}</div>
                  </div>
                  <div>
                    <span style={{ fontWeight: 500, fontSize: 9 }}>Recent Z:</span>
                    <div style={{ color: '#ff9800', fontWeight: 600 }}>{playerTrends[playerId].recentZ.toFixed(2)}</div>
                  </div>
                </div>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 500, fontSize: 9 }}>Z-Difference:</span>
                  <div
                    style={{
                      color: playerTrends[playerId].zDifference > 0 ? '#4caf50' : '#f44336',
                      fontWeight: 600,
                    }}
                  >
                    {playerTrends[playerId].zDifference > 0 ? '+' : ''}{playerTrends[playerId].zDifference.toFixed(2)}
                  </div>
                </div>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 500, fontSize: 9 }}>Confidence:</span>
                  <div style={{ color: '#666', fontWeight: 600 }}>{playerTrends[playerId].confidenceScore.toFixed(0)}/100</div>
                </div>
                <div style={{ fontSize: 9, color: '#666', lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 500 }}>Reasoning:</span> {playerTrends[playerId].reasoning}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Calculate roster totals
  const calculateRosterTotals = (playerIds: string[]) => {
    const totals: { [key: string]: number } = {};
    let totalZ = 0;
    let praTotal = 0;

    playerIds.forEach((playerId) => {
      const playerData = playerZScores[playerId];
      if (!playerData) return;

      totalZ += playerData.totalZ;
      const playerPra =
        typeof playerData.praZ === 'number'
          ? playerData.praZ
          : (playerData.scores.pts ?? 0) + (playerData.scores.reb ?? 0) + (playerData.scores.ast ?? 0);
      praTotal += playerPra;
      Object.entries(playerData.scores).forEach(([cat, score]: [string, any]) => {
        totals[cat] = (totals[cat] || 0) + (typeof score === 'number' ? score : 0);
      });
    });

    return { totalZ, categoryTotals: totals, praTotal };
  };

  return (
    <div style={{ marginTop: 8 }}>
      {/* Roster Totals Summary */}
      {Object.keys(playerZScores).length > 0 && (
        <div style={{ marginBottom: 12, padding: 8, background: '#f0f0f0', borderRadius: 6, fontSize: 11 }}>
          {(() => {
            const allPlayerIds = [...(roster.starters ?? [])]; // Only starters, exclude bench
            const totals = calculateRosterTotals(allPlayerIds);
            const praColor = Math.abs(totals.praTotal) < 1 ? '#666666' : totals.praTotal > 0 ? '#4caf50' : '#f44336';
            return (
              <>
                <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 12, color: '#333' }}>
                  Starters Total Z-Score: <span style={{ color: '#2196F3' }}>{totals.totalZ.toFixed(2)}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4 }}>
                  {Object.entries(totals.categoryTotals).map(([cat, total]: [string, number]) => {
                    const catName = STAT_NAMES[cat] || cat;
                    const scoreColor = total > 0 ? '#4caf50' : total < 0 ? '#f44336' : '#999999';
                    return (
                      <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 4px' }}>
                        <span style={{ fontWeight: 500 }}>{catName}:</span>
                        <span style={{ color: scoreColor, fontWeight: 600 }}>{total.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    paddingTop: 6,
                    borderTop: '1px solid #dcdcdc',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontWeight: 600, color: '#333' }}>Starters PRA Z-Score:</span>
                  <span style={{ color: praColor, fontWeight: 700 }}>{totals.praTotal.toFixed(2)}</span>
                </div>
              </>
            );
          })()}
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#333' }}>
        Starters ({roster.starters?.length ?? 0})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
        {(roster.starters ?? []).map((playerId: string) => renderPlayerRow(playerId, true))}
      </div>

      {benchPlayers.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#666' }}>
            Bench ({benchPlayers.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {benchPlayers.map((player) => renderPlayerRow(player.id, false))}
          </div>
        </>
      )}

      {(roster.reserve?.length ?? 0) > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, marginTop: 12, color: '#d9534f' }}>
            IR ({roster.reserve?.length ?? 0})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(roster.reserve ?? []).map((playerId: string) => {
              const player = players.find((p) => p.id === playerId);
              return (
                <div
                  key={playerId}
                  style={{
                    padding: '4px 6px',
                    background: '#ffe6e6',
                    borderRadius: 4,
                    fontSize: 11,
                    display: 'flex',
                    justifyContent: 'space-between',
                    color: '#c9302c',
                  }}
                >
                  <span>{player?.name || playerId}</span>
                  <span>{player?.position} ({player?.team})</span>
                </div>
              );
            })}
          </div>
        </>
      )}

    </div>
  );
};

export default RosterView;
