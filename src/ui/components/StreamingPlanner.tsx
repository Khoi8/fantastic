import React, { useEffect, useMemo, useState } from 'react';
import { PlayerZScores } from '../../types/sleeper';
import { getScheduleWindow } from '../../utils/scheduleService';
import { buildStreamingPlan, StreamingPlan } from '../../utils/streamingLogic';
import { getLeagueMatchups } from '../../api/main';

interface StreamingPlannerProps {
  leagueId?: string;
  roster: any;
  allRosters: any[];
  rosterPositions?: string[];
  playerZScores: PlayerZScores;
  playersMap: Record<string, any>;
}

const fetchCurrentSleeperWeek = async (): Promise<number> => {
  const response = await fetch('https://api.sleeper.app/v1/state/nba');
  if (!response.ok) {
    throw new Error('Failed to fetch Sleeper state');
  }
  const data = await response.json();
  return Number(data.week ?? data.display_week ?? data.prev_display_week ?? 1);
};

const StreamingPlanner: React.FC<StreamingPlannerProps> = ({
  leagueId,
  roster,
  allRosters,
  rosterPositions,
  playerZScores,
  playersMap,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<StreamingPlan | null>(null);

  const isReady = useMemo(() => {
    return (
      Boolean(leagueId) &&
      Boolean(roster?.roster_id) &&
      allRosters?.length > 0 &&
      Object.keys(playerZScores ?? {}).length > 0 &&
      Object.keys(playersMap ?? {}).length > 0
    );
  }, [leagueId, roster?.roster_id, allRosters, playerZScores, playersMap]);

  useEffect(() => {
    if (!isReady) return;
    let isMounted = true;

    const loadPlan = async () => {
      try {
        setLoading(true);
        setError(null);

        const [week, scheduleWindow] = await Promise.all([
          fetchCurrentSleeperWeek(),
          getScheduleWindow(7),
        ]);

        const matchupsResponse = leagueId ? await getLeagueMatchups(leagueId, week) : null;
        const matchupData = matchupsResponse?.data ?? [];

        const nextPlan = buildStreamingPlan({
          leagueId,
          roster,
          allRosters,
          rosterPositions,
          playerZScores,
          playersMap,
          dailySchedule: scheduleWindow.daily,
          teamGameMap: scheduleWindow.teamGameMap,
          matchups: matchupData,
        });

        if (isMounted) {
          setPlan(nextPlan);
        }
      } catch (err: any) {
        console.error('Failed to build streaming planner', err);
        if (isMounted) {
          setError(err?.message ?? 'Unable to load streaming planner');
          setPlan(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadPlan();
    return () => {
      isMounted = false;
    };
  }, [isReady, leagueId, roster, allRosters, rosterPositions, playerZScores, playersMap]);

  if (!isReady) {
    return null;
  }

  return (
    <div style={{ marginTop: 16, padding: 12, border: '1px solid #e0e0e0', borderRadius: 8, background: '#fafafa' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1a237e' }}>Streaming Planner (Next 7 Days)</div>
          <div style={{ fontSize: 11, color: '#555' }}>
            Auto-detects roster holes and highlights the best free agents to add on low-volume days.
          </div>
        </div>
        {plan && (
          <div style={{ fontSize: 10, color: '#777' }}>Updated {new Date(plan.generatedAt).toLocaleTimeString()}</div>
        )}
      </div>

      {loading && <div style={{ fontSize: 11, color: '#777' }}>Crunching schedules...</div>}
      {error && <div style={{ fontSize: 11, color: '#c62828' }}>{error}</div>}

      {!loading && !error && plan && (
        <>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ minWidth: 140 }}>
              <div style={{ fontSize: 11, color: '#666' }}>Active Slots</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{plan.metadata.activeSlots}</div>
            </div>
            <div style={{ minWidth: 140 }}>
              <div style={{ fontSize: 11, color: '#666' }}>Bench Slots</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{plan.metadata.benchSlots}</div>
            </div>
            <div style={{ minWidth: 140 }}>
              <div style={{ fontSize: 11, color: '#666' }}>Roster Size</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{plan.metadata.totalRosterPlayers}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {plan.days.map((day) => (
              <div
                key={day.date}
                style={{
                  border: '1px solid #e0e0e0',
                  borderRadius: 8,
                  padding: 10,
                  background: '#fff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{day.dayLabel}</div>
                    <div style={{ fontSize: 11, color: '#777' }}>{day.nbaGames} NBA games</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#555' }}>Players with games</div>
                    <div style={{ fontWeight: 700 }}>
                      {day.playersAvailable} / {day.activeSlots}
                    </div>
                    {day.holes > 0 && (
                      <div style={{ fontSize: 10, color: '#c62828' }}>Need {day.holes} stream{day.holes > 1 ? 's' : ''}</div>
                    )}
                  </div>
                </div>

                {day.ownPlayers.length > 0 ? (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#3949ab', marginBottom: 4 }}>Your players</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {day.ownPlayers.map((player) => (
                        <div
                          key={player.playerId}
                          style={{
                            border: '1px solid #dfe3f3',
                            borderRadius: 6,
                            padding: '4px 8px',
                            fontSize: 10,
                            background: player.isStarter ? '#e8eaf6' : '#f5f5f5',
                          }}
                        >
                          <div style={{ fontWeight: 600 }}>{player.name}</div>
                          <div style={{ color: '#666' }}>{player.team} · {player.positions.join('/')}</div>
                          <div style={{ color: player.zScore >= 0 ? '#2e7d32' : '#c62828' }}>
                            Z {player.zScore.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: '#777', marginBottom: 8 }}>No one on your roster plays.</div>
                )}

                {day.recommendations.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#2e7d32', marginBottom: 4 }}>Suggested streamers</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {day.recommendations.map((rec) => (
                        <div
                          key={rec.playerId}
                          style={{
                            border: '1px solid #c8e6c9',
                            borderRadius: 6,
                            padding: '4px 8px',
                            fontSize: 10,
                            background: '#e8f5e9',
                            flex: '1 1 180px',
                          }}
                        >
                          <div style={{ fontWeight: 600 }}>{rec.name}</div>
                          <div style={{ color: '#388e3c' }}>{rec.team} · {rec.positions.join('/')}</div>
                          <div style={{ color: '#2e7d32' }}>Z {rec.zScore.toFixed(2)}</div>
                          <div style={{ fontSize: 9, color: '#555', marginTop: 4 }}>{rec.reason}</div>
                          {rec.upcomingGames.length > 0 && (
                            <div style={{ fontSize: 9, color: '#333', marginTop: 2 }}>
                              Next: {rec.upcomingGames.map((g) => `${g.date} vs ${g.homeTeam === rec.team ? g.awayTeam : g.homeTeam}`).join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default StreamingPlanner;
