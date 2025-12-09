import { DailySchedule, NBAGameSummary } from './scheduleService';
import { PlayerZScores } from '../types/sleeper';

export interface PlayerStreamingInfo {
  playerId: string;
  name: string;
  team: string;
  positions: string[];
  isStarter: boolean;
  zScore: number;
  upcomingGames: NBAGameSummary[];
}

export interface StreamCandidate extends PlayerStreamingInfo {
  reason: string;
}

export interface StreamingDayPlan {
  date: string;
  dayLabel: string;
  nbaGames: number;
  teamsPlaying: string[];
  activeSlots: number;
  playersAvailable: number;
  holes: number;
  ownPlayers: PlayerStreamingInfo[];
  recommendations: StreamCandidate[];
}

export interface StreamingPlan {
  rosterId?: number;
  leagueId?: string;
  generatedAt: string;
  metadata: {
    activeSlots: number;
    benchSlots: number;
    totalRosterPlayers: number;
  };
  days: StreamingDayPlan[];
}

export interface StreamingInput {
  roster: any;
  allRosters: any[];
  rosterPositions?: string[];
  playerZScores: PlayerZScores;
  playersMap: Record<string, any>;
  dailySchedule: DailySchedule[];
  teamGameMap: Record<string, NBAGameSummary[]>;
  matchups?: any[];
  leagueId?: string;
}

const BENCH_CODES = new Set(['BN', 'IR', 'IR+', 'NA']);

const toDayLabel = (isoDate: string) => {
  const date = new Date(isoDate);
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

const getActiveSlotCount = (rosterPositions: string[] = []) => {
  return rosterPositions.filter((slot) => slot && !BENCH_CODES.has(slot.toUpperCase())).length;
};

const getBenchSlotCount = (rosterPositions: string[] = []) => {
  return rosterPositions.filter((slot) => BENCH_CODES.has(slot.toUpperCase())).length;
};

const buildStarterSet = (matchups: any[] | undefined, rosterId: number | undefined, fallbackStarters?: string[]) => {
  if (!matchups || !rosterId) {
    return new Set(fallbackStarters ?? []);
  }

  const matchupEntry = matchups.find((m) => Number(m.roster_id) === Number(rosterId));
  if (matchupEntry?.starters?.length) {
    return new Set(matchupEntry.starters.filter(Boolean));
  }

  return new Set(fallbackStarters ?? []);
};

const buildRosteredSet = (allRosters: any[] = []) => {
  const rostered = new Set<string>();
  allRosters.forEach((team) => {
    (team.players ?? []).forEach((playerId: string) => rostered.add(playerId));
  });
  return rostered;
};

const getPlayerMeta = (playerId: string, playersMap: Record<string, any>) => {
  const meta = playersMap[playerId] ?? {};
  const positions: string[] = meta.fantasy_positions?.length
    ? meta.fantasy_positions
    : meta.position
    ? [meta.position]
    : [];

  const name = meta.full_name
    ? meta.full_name
    : meta.first_name && meta.last_name
    ? `${meta.first_name} ${meta.last_name}`
    : meta.search_full_name
    ? meta.search_full_name
    : playerId;

  return {
    name,
    positions,
    team: meta.team ?? '',
  };
};

const collectFreeAgents = (
  playerZScores: PlayerZScores,
  playersMap: Record<string, any>,
  rosteredSet: Set<string>
) => {
  const agents: StreamCandidate[] = [];

  Object.entries(playerZScores).forEach(([playerId, zData]) => {
    if (rosteredSet.has(playerId)) return;
    const { name, positions, team } = getPlayerMeta(playerId, playersMap);
    if (!team) return;

    agents.push({
      playerId,
      name,
      positions,
      team,
      isStarter: false,
      zScore: zData.totalZ ?? 0,
      upcomingGames: [],
      reason: 'Top free agent by z-score',
    });
  });

  agents.sort((a, b) => b.zScore - a.zScore);
  return agents.slice(0, 200);
};

const enrichWithUpcomingGames = (
  entries: PlayerStreamingInfo[],
  teamGameMap: Record<string, NBAGameSummary[]>,
  referenceDate: string,
  limit = 3
) => {
  return entries.map((entry) => {
    const games = (teamGameMap[entry.team] ?? []).filter((game) => game.date >= referenceDate).slice(0, limit);
    return { ...entry, upcomingGames: games };
  });
};

export const buildStreamingPlan = (input: StreamingInput): StreamingPlan => {
  const {
    roster,
    allRosters,
    rosterPositions = [],
    playerZScores,
    playersMap,
    dailySchedule,
    teamGameMap,
    matchups,
    leagueId,
  } = input;

  const activeSlots = getActiveSlotCount(rosterPositions);
  const benchSlots = getBenchSlotCount(rosterPositions);
  const starters = buildStarterSet(matchups, roster?.roster_id, roster?.starters);
  const rosteredSet = buildRosteredSet(allRosters);
  const freeAgents = collectFreeAgents(playerZScores, playersMap, rosteredSet);

  const rosterPlayers: PlayerStreamingInfo[] = (roster?.players ?? []).map((playerId: string): PlayerStreamingInfo => {
    const { name, positions, team } = getPlayerMeta(playerId, playersMap);
    const zScore = playerZScores[playerId]?.totalZ ?? 0;
    return {
      playerId,
      name,
      positions,
      team,
      isStarter: starters.has(playerId),
      zScore,
      upcomingGames: [] as NBAGameSummary[],
    };
  });

  const days: StreamingDayPlan[] = dailySchedule.map((day) => {
    const dayTeams = new Set(day.teamsPlaying);
    const playersAvailable = rosterPlayers
      .filter((player) => player.team && dayTeams.has(player.team))
      .map((player) => ({ ...player }));

    const holes = Math.max(0, activeSlots - playersAvailable.length);

    const enrichedOwnPlayers = enrichWithUpcomingGames(playersAvailable, teamGameMap, day.date, 2);

    let recommendations: StreamCandidate[] = [];
    if (holes > 0) {
      const faOptions = freeAgents.filter((agent) => agent.team && dayTeams.has(agent.team));
      const enrichedCandidates = enrichWithUpcomingGames(faOptions, teamGameMap, day.date, 3).map((entry) => ({
        ...entry,
        reason: `Plays on ${day.date} and ranks among top available z-scores`,
      }));
      recommendations = enrichedCandidates.slice(0, Math.min(holes * 2, 5));
    }

    return {
      date: day.date,
      dayLabel: toDayLabel(day.isoDate),
      nbaGames: day.games.length,
      teamsPlaying: day.teamsPlaying,
      activeSlots,
      playersAvailable: playersAvailable.length,
      holes,
      ownPlayers: enrichedOwnPlayers.sort((a, b) => (a.isStarter === b.isStarter ? b.zScore - a.zScore : a.isStarter ? -1 : 1)),
      recommendations,
    };
  });

  return {
    rosterId: roster?.roster_id,
    leagueId,
    generatedAt: new Date().toISOString(),
    metadata: {
      activeSlots,
      benchSlots,
      totalRosterPlayers: roster?.players?.length ?? 0,
    },
    days,
  };
};
