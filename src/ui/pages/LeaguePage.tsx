import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getLeagueById, getLeagueRosters, getLeagueUsers } from "../../api/main";
import RosterView from "../components/RosterView";

const LeaguePage: React.FC = () => {
  const { leagueId } = useParams();
  const [league, setLeague] = useState<any | null>(null);
  const [rosters, setRosters] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRosterId, setExpandedRosterId] = useState<number | null>(null);

  useEffect(() => {
    if (!leagueId) return;
    setLoading(true);
    // Fetch league, rosters and users in parallel
    Promise.all([getLeagueById(leagueId), getLeagueRosters(leagueId), getLeagueUsers(leagueId)])
      .then(([leagueRes, rostersRes, usersRes]) => {
        setLeague(leagueRes.data);
        const rostersData = rostersRes.data ?? null;
        const usersData = usersRes.data ?? [];

        // Build a lookup map of user_id -> user object for quick mapping
        const userById = new Map<string, any>();
        usersData.forEach((u: any) => {
          // typical sleeper user key is `user_id` or `user_id`
          const id = u.user_id ?? u.userId ?? u.user;
          if (id) userById.set(String(id), u);
        });

        // Attach owner info to rosters
        if (rostersData) {
          const mapped = rostersData.map((r: any) => {
            const ownerId = r.owner_id ?? r.owner;
            const owner = ownerId ? userById.get(String(ownerId)) : null;
            return {
              ...r,
              ownerInfo: owner ?? null,
              ownerDisplay: owner ? owner.display_name ?? owner.username ?? owner.name ?? String(ownerId) : (ownerId ?? null),
            };
          });
          setRosters(mapped);
        } else {
          setRosters(null);
        }
      })
      .catch(() => setError("Failed to load league, rosters or users."))
      .finally(() => setLoading(false));
  }, [leagueId]);

  if (!leagueId) return <div>No league id provided.</div>;
  if (loading) return <div>Loading league...</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;

  return (
    <div>
      <h1>League {leagueId}</h1>
      {league ? <pre>{JSON.stringify(league, null, 2)}</pre> : <div>No data</div>}
      <h2>Rosters</h2>
      {rosters ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
          {rosters.map((r) => (
            <div
              key={r.roster_id}
              onClick={() => setExpandedRosterId(expandedRosterId === r.roster_id ? null : r.roster_id)}
              style={{
                border: "1px solid #ddd",
                padding: 12,
                borderRadius: 6,
                cursor: "pointer",
                background: expandedRosterId === r.roster_id ? "#f9f9f9" : "white",
                transition: "background 0.2s",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{r.name ?? `Roster ${r.roster_id}`}</div>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 2 }}>Owner: {r.ownerDisplay}</div>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 8 }}>
                Players: {(r.players && r.players.length) ?? 0}
              </div>
              {expandedRosterId === r.roster_id && <RosterView roster={r} />}
            </div>
          ))}
        </div>
      ) : (
        <div>No rosters available.</div>
      )}
    </div>
  );
};

export default LeaguePage;
