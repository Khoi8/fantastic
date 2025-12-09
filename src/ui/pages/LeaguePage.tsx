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

  useEffect(() => {
    if (!leagueId) return;
    setLoading(true);
    // Fetch league, rosters and users in parallel
    Promise.all([getLeagueById(leagueId), getLeagueRosters(leagueId), getLeagueUsers(leagueId)])
      .then(([leagueRes, rostersRes, usersRes]) => {
        console.log('League Data:', leagueRes.data);
        console.log('Rosters Data:', rostersRes.data);
        console.log('Users Data:', usersRes.data);
        console.log('Scoring Settings:', leagueRes.data?.scoring_settings);
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
      <h1>{league?.name ?? `League ${leagueId}`}</h1>
      <h2>Rosters</h2>
      {rosters ? (
        <div style={{ display: "flex", flexDirection: "row", gap: 16, flexWrap: "wrap" }}>
          {rosters.map((r) => (
            <div key={r.roster_id} style={{ border: "1px solid #ddd", padding: 12, borderRadius: 6, minWidth: 320 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
                {r.name ?? `Roster ${r.roster_id}`}
              </div>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>Owner: {r.ownerDisplay}</div>
              <RosterView roster={r} allRosters={rosters} scoringSettings={league.scoring_settings} />
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
