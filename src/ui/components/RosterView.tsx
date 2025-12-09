import React, { useEffect, useState } from 'react';
import { getCachedPlayersNBA } from '../../utils/playerCache';
import { getCachedNBAStats } from '../../utils/statsCache';
import { calculateZScores } from '../../utils/zScoreCalculator';
import { recommendTrades } from '../../utils/tradeRecommender';
import { calculateConsistency, getRiskColor, formatConsistency } from '../../utils/consistencyRating';

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
  const [playerConsistency, setPlayerConsistency] = useState<{ [playerId: string]: any }>({});
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [selectedNeedCategory, setSelectedNeedCategory] = useState<string | null>(null);
  const [selectedSpareCategory, setSelectedSpareCategory] = useState<string | null>(null);
  const [tradeRecommendations, setTradeRecommendations] = useState<any[]>([]);

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

              // Calculate consistency rating for each player based on their stats
              const consistency: { [playerId: string]: any } = {};
              Object.entries(zScores).forEach(([playerId, playerData]) => {
                const statData = stats[playerId];
                if (statData) {
                  const playerConsistency = calculateConsistency(statData);
                  consistency[playerId] = playerConsistency;
                }
              });
              setPlayerConsistency(consistency);
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
          <div style={{ flex: 1 }}>
            <div>{player?.name || playerId}</div>
            <div style={{ fontSize: 10, color: '#999' }}>
              {player?.position} ({player?.team})
            </div>
          </div>
          <div style={{ minWidth: 50, textAlign: 'right', fontWeight: 600, fontSize: 12 }}>
            {typeof zScore === 'number' ? zScore.toFixed(2) : zScore}
          </div>
        </div>

        {isExpanded && playerZScores[playerId] && (
          <div style={{ marginTop: 4, padding: '8px', background: '#f9f9f9', borderRadius: 4, fontSize: 10 }}>
            {/* Consistency Rating */}
            {playerConsistency[playerId] && playerConsistency[playerId].riskLevel !== 'N/A' && (
              <div style={{ marginBottom: 8, padding: 6, background: '#f5f5f5', borderRadius: 3, border: `2px solid ${getRiskColor(playerConsistency[playerId].riskLevel)}` }}>
                <div style={{ fontWeight: 600, marginBottom: 4, color: '#333' }}>
                  Consistency Rating
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4, fontSize: 9 }}>
                  <div>
                    <span style={{ fontWeight: 500 }}>Risk Level:</span>{' '}
                    <span style={{ color: getRiskColor(playerConsistency[playerId].riskLevel), fontWeight: 600 }}>
                      {playerConsistency[playerId].riskLevel}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontWeight: 500 }}>CV:</span>{' '}
                    <span style={{ color: getRiskColor(playerConsistency[playerId].riskLevel), fontWeight: 600 }}>
                      {playerConsistency[playerId].cv.toFixed(3)}
                    </span>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ fontWeight: 500 }}>Profile:</span> {formatConsistency(playerConsistency[playerId].cv)}
                  </div>
                </div>
              </div>
            )}

            <div style={{ fontWeight: 600, marginBottom: 6, color: '#333' }}>Category Z-Scores:</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4, marginBottom: 8 }}>
              {Object.entries(playerZScores[playerId].scores).map(([cat, score]: [string, any]) => {
                const scoreNum = typeof score === 'number' ? score : 0;
                const catColor = getCategoryColor(scoreNum);
                const catName = STAT_NAMES[cat] || cat; // Use full name, fallback to abbreviation
                const scoreColor = scoreNum > 0 ? '#4caf50' : scoreNum < 0 ? '#f44336' : '#999999'; // Green for positive, red for negative, gray for zero
                const isSelected = selectedNeedCategory === cat;
                const isSpareSelected = selectedSpareCategory === cat;
                return (
                  <div
                    key={cat}
                    onClick={() => {
                      if (selectedNeedCategory && selectedNeedCategory !== cat) {
                        // If we already have a need category, clicking another sets it as spare
                        setSelectedSpareCategory(cat);
                      } else if (!selectedNeedCategory) {
                        // First click - set as need category
                        setSelectedNeedCategory(cat);
                        setSelectedSpareCategory(null);
                      } else {
                        // Deselect
                        setSelectedNeedCategory(null);
                        setSelectedSpareCategory(null);
                      }
                    }}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '4px 4px',
                      cursor: 'pointer',
                      background: isSelected ? '#e3f2fd' : isSpareSelected ? '#fff3cd' : 'transparent',
                      borderRadius: 3,
                      border: isSelected ? '1px solid #2196F3' : isSpareSelected ? '1px solid #ff9800' : 'none',
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{catName}:</span>
                    <span style={{ color: scoreColor, fontWeight: 600 }}>{scoreNum.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
            {selectedNeedCategory && (
              <div style={{ padding: '4px', background: '#fff3cd', borderRadius: 3, fontSize: 9, color: '#856404' }}>
                {selectedSpareCategory ? '✓ Categories selected' : 'Click a category in another player to set as spare'}
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

    playerIds.forEach((playerId) => {
      const playerData = playerZScores[playerId];
      if (!playerData) return;

      totalZ += playerData.totalZ;
      Object.entries(playerData.scores).forEach(([cat, score]: [string, any]) => {
        totals[cat] = (totals[cat] || 0) + (typeof score === 'number' ? score : 0);
      });
    });

    return { totalZ, categoryTotals: totals };
  };

  return (
    <div style={{ marginTop: 8 }}>
      {/* Roster Totals Summary */}
      {Object.keys(playerZScores).length > 0 && (
        <div style={{ marginBottom: 12, padding: 8, background: '#f0f0f0', borderRadius: 6, fontSize: 11 }}>
          {(() => {
            const allPlayerIds = [...(roster.starters ?? [])]; // Only starters, exclude bench
            const totals = calculateRosterTotals(allPlayerIds);
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

      {/* Trade Recommendations Panel */}
      {selectedNeedCategory && selectedSpareCategory && (
        <div style={{ marginTop: 16, padding: 12, background: '#f0f7ff', borderRadius: 6, border: '2px solid #2196F3' }}>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 12, color: '#1976D2' }}>
            Trade Recommendations
          </div>
          <div style={{ fontSize: 10, marginBottom: 8, color: '#555' }}>
            Looking for players strong in <strong>{STAT_NAMES[selectedNeedCategory] || selectedNeedCategory}</strong>, offering{' '}
            <strong>{STAT_NAMES[selectedSpareCategory] || selectedSpareCategory}</strong>
          </div>
          {(() => {
            if (!allRosters) return null;
            const suggestions = recommendTrades(
              roster.roster_id,
              allRosters,
              playerZScores,
              selectedNeedCategory,
              selectedSpareCategory,
              allRosters.reduce((acc: any, r: any) => {
                acc[String(r.roster_id)] = r.ownerDisplay || `Team ${r.roster_id}`;
                return acc;
              }, {})
            );
            return (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {suggestions.length === 0 ? (
                  <div style={{ color: '#999', fontSize: 10 }}>No suggestions available</div>
                ) : (
                  suggestions.slice(0, 10).map((suggestion: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        padding: 6,
                        marginBottom: 4,
                        background: 'white',
                        borderRadius: 4,
                        border: '1px solid #e0e0e0',
                        fontSize: 10,
                      }}
                    >
                      <div style={{ fontWeight: 600, color: '#333' }}>{suggestion.playerName}</div>
                      <div style={{ fontSize: 9, color: '#999', marginBottom: 4 }}>{suggestion.ownerName}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
                        <div>
                          <span style={{ fontWeight: 500 }}>{STAT_NAMES[selectedNeedCategory] || selectedNeedCategory}:</span>{' '}
                          <span
                            style={{
                              color:
                                suggestion.stats.needCategoryZ > 0
                                  ? '#4caf50'
                                  : suggestion.stats.needCategoryZ < 0
                                    ? '#f44336'
                                    : '#999999',
                              fontWeight: 600,
                            }}
                          >
                            {suggestion.stats.needCategoryZ.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontWeight: 500 }}>{STAT_NAMES[selectedSpareCategory] || selectedSpareCategory}:</span>{' '}
                          <span
                            style={{
                              color:
                                suggestion.stats.spareCategoryZ > 0
                                  ? '#4caf50'
                                  : suggestion.stats.spareCategoryZ < 0
                                    ? '#f44336'
                                    : '#999999',
                              fontWeight: 600,
                            }}
                          >
                            {suggestion.stats.spareCategoryZ.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div style={{ padding: 4, background: '#e8f5e9', borderRadius: 3, fontSize: 9, color: '#2e7d32', fontWeight: 600 }}>
                        Trade Score: {suggestion.stats.tradeScore.toFixed(2)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            );
          })()}
          <div
            onClick={() => {
              setSelectedNeedCategory(null);
              setSelectedSpareCategory(null);
            }}
            style={{
              marginTop: 8,
              padding: 4,
              background: '#ffebee',
              borderRadius: 3,
              textAlign: 'center',
              cursor: 'pointer',
              fontSize: 10,
              color: '#c9302c',
              fontWeight: 600,
            }}
          >
            Clear
          </div>
        </div>
      )}
    </div>
  );
};

export default RosterView;
