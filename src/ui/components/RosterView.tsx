import React, { useEffect, useState } from 'react';
import { getCachedPlayersNBA } from '../../utils/playerCache';

interface RosterViewProps {
  roster: any;
}

const RosterView: React.FC<RosterViewProps> = ({ roster }) => {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPlayers = async () => {
      try {
        const playersMap = await getCachedPlayersNBA();
        if (!playersMap || !roster.players) {
          setPlayers([]);
          return;
        }

        // Map roster player IDs to player objects
        const playerList = (roster.players as string[])
          .map((playerId) => {
            const player = playersMap[playerId];
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

        setPlayers(playerList);
      } catch (error) {
        console.error('Error loading players:', error);
        setPlayers([]);
      } finally {
        setLoading(false);
      }
    };

    loadPlayers();
  }, [roster]);

  if (loading) return <div style={{ fontSize: 12, color: '#999' }}>Loading players...</div>;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#333' }}>
        Starters ({roster.starters?.length ?? 0})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
        {(roster.starters ?? []).map((playerId: string) => {
          const player = players.find((p) => p.id === playerId);
          return (
            <div
              key={playerId}
              style={{
                padding: '4px 6px',
                background: '#f5f5f5',
                borderRadius: 4,
                fontSize: 11,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>{player?.name || playerId}</span>
              <span style={{ color: '#666' }}>
                {player?.position} ({player?.team})
              </span>
            </div>
          );
        })}
      </div>

      {(roster.reserve?.length ?? 0) > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#666' }}>
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
                    background: '#fafafa',
                    borderRadius: 4,
                    fontSize: 11,
                    display: 'flex',
                    justifyContent: 'space-between',
                    color: '#777',
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
