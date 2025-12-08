import React, { useEffect, useState } from "react";
import { getUserLeaguesForUser } from "../../api/main";
import { getCookie } from "../../utils/cookies";

type League = any;

type Props = {
  userId?: string | number;
  sport?: string;
  season?: string;
  onSelect?: (league: League) => void;
};

const LeaugePicker: React.FC<Props> = ({ userId, sport = "nba", season, onSelect }) => {
  const [leagues, setLeagues] = useState<League[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = userId ?? getCookie("userId");
    if (!id) {
      setError("No user id available. Please set a user id in cookies or pass `userId` prop.");
      return;
    }

    setLoading(true);
    getUserLeaguesForUser(id, sport, season)
      .then((res) => {
        setLeagues(res.data ?? null);
      })
      .catch(() => setError("Failed to fetch leagues."))
      .finally(() => setLoading(false));
  }, [userId, sport, season]);

  if (loading) return <div>Loading leagues...</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;
  if (!leagues || leagues.length === 0) return <div>No leagues found for this user.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {leagues.map((l: any) => (
        <button
          key={l.league_id}
          onClick={() => onSelect?.(l)}
          style={{
            padding: "8px 12px",
            textAlign: "left",
            borderRadius: 6,
            border: "1px solid #ddd",
            background: "white",
            cursor: "pointer",
          }}
        >
          <div style={{ fontWeight: 600 }}>{l.name}</div>
          <div style={{ fontSize: 12, color: "#666" }}>
            {l.season} — {l.status}
          </div>
        </button>
      ))}
    </div>
  );
};

export default LeaugePicker;
