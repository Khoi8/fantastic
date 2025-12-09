import { get, set } from 'idb-keyval';

export interface NBAGameSummary {
  gameId: string;
  date: string; // YYYY-MM-DD
  tipoffUTC: string;
  homeTeam: string;
  awayTeam: string;
}

export interface DailySchedule {
  date: string;
  isoDate: string;
  games: NBAGameSummary[];
  teamsPlaying: string[];
}

export interface ScheduleWindow {
  daily: DailySchedule[];
  teamGameMap: Record<string, NBAGameSummary[]>;
}

const NBA_SCHEDULE_URL = 'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json';
const NBA_DATA_URL = 'https://data.nba.com/data/10s/v2015/json/mobile_teams/nba';
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours

interface MemoryCacheEntry {
  games: NBAGameSummary[];
  fetchedAt: number;
  seasonKey: string;
}

let memoryCache: MemoryCacheEntry | null = null;

const getSeasonStartYear = (refDate = new Date()): number => {
  const year = refDate.getUTCFullYear();
  const month = refDate.getUTCMonth();
  return month >= 7 ? year : year - 1; // NBA season starts around August/September
};

const getSeasonKey = () => {
  const startYear = getSeasonStartYear();
  const endYear = startYear + 1;
  return `${startYear}-${endYear}`;
};

const buildCacheKeys = () => {
  const seasonKey = getSeasonKey();
  return {
    seasonKey,
    dataKey: `nba_schedule_full_${seasonKey}`,
    tsKey: `nba_schedule_full_ts_${seasonKey}`,
  };
};

const toStartOfDayUTC = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const parseDateOnly = (dateStr: string) => new Date(`${dateStr}T00:00:00Z`);

const fetchScheduleFromCDN = async (): Promise<NBAGameSummary[]> => {
  const response = await fetch(NBA_SCHEDULE_URL);
  if (!response.ok) {
    throw new Error('Failed to fetch NBA schedule');
  }
  const data = await response.json();
  const gameDates = data?.leagueSchedule?.gameDates ?? [];

  const games: NBAGameSummary[] = [];
  gameDates.forEach((dateEntry: any) => {
    const currentDate = dateEntry.gameDate;
    (dateEntry.games ?? []).forEach((game: any) => {
      games.push({
        gameId: game.gameId,
        date: currentDate,
        tipoffUTC: game.gameDateTimeUTC,
        homeTeam: game.homeTeam?.teamTricode ?? '',
        awayTeam: game.awayTeam?.teamTricode ?? '',
      });
    });
  });

  return games;
};

const fetchScheduleFromDataAPI = async (seasonStartYear: number): Promise<NBAGameSummary[]> => {
  const url = `${NBA_DATA_URL}/${seasonStartYear}/league/00_full_schedule.json`;
  const response = await fetch(url, {
    headers: {
      'Cache-Control': 'no-cache',
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch NBA schedule from data.nba.com');
  }

  const data = await response.json();
  const months = data?.lscd ?? [];

  const games: NBAGameSummary[] = [];
  months.forEach((month: any) => {
    const monthGames = month?.mscd?.g ?? [];
    monthGames.forEach((game: any) => {
      games.push({
        gameId: String(game.gid ?? game.gameId ?? game.gameIdLong ?? ''),
        date: game.gdte,
        tipoffUTC: game.gdtutc,
        homeTeam: game.h?.ta ?? game.h?.tc ?? '',
        awayTeam: game.v?.ta ?? game.v?.tc ?? '',
      });
    });
  });

  if (!games.length) {
    throw new Error('NBA schedule response was empty');
  }

  return games;
};

const fetchSchedule = async (): Promise<NBAGameSummary[]> => {
  const seasonStartYear = getSeasonStartYear();
  try {
    return await fetchScheduleFromDataAPI(seasonStartYear);
  } catch (primaryError) {
    console.warn('Primary schedule source failed, falling back to CDN', primaryError);
    return await fetchScheduleFromCDN();
  }
};

const loadSchedule = async (): Promise<NBAGameSummary[]> => {
  const { seasonKey, dataKey, tsKey } = buildCacheKeys();

  if (
    memoryCache &&
    memoryCache.seasonKey === seasonKey &&
    Date.now() - memoryCache.fetchedAt < CACHE_TTL
  ) {
    return memoryCache.games;
  }

  try {
    const [cachedData, cachedTs] = await Promise.all([
      get<NBAGameSummary[]>(dataKey),
      get<number>(tsKey),
    ]);

    if (cachedData && cachedTs && Date.now() - cachedTs < CACHE_TTL) {
      memoryCache = { games: cachedData, fetchedAt: cachedTs, seasonKey };
      return cachedData;
    }
  } catch (error) {
    console.warn('Failed to read schedule cache', error);
  }

  const games = await fetchSchedule();
  memoryCache = { games, fetchedAt: Date.now(), seasonKey };

  try {
    await Promise.all([set(dataKey, games), set(tsKey, Date.now())]);
  } catch (error) {
    console.warn('Failed to persist schedule cache', error);
  }

  return games;
};

export const getScheduleWindow = async (days = 7, startDate = new Date()): Promise<ScheduleWindow> => {
  const games = await loadSchedule();
  const start = toStartOfDayUTC(startDate);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + days);

  const dailyMap = new Map<string, DailySchedule>();
  const teamGameMap: Record<string, NBAGameSummary[]> = {};

  games.forEach((game) => {
    const gameDay = parseDateOnly(game.date);
    if (gameDay < start || gameDay >= end) return;

    if (!dailyMap.has(game.date)) {
      dailyMap.set(game.date, {
        date: game.date,
        isoDate: gameDay.toISOString(),
        games: [],
        teamsPlaying: [],
      });
    }

    const dayEntry = dailyMap.get(game.date)!;
    dayEntry.games.push(game);

    const teams = [game.homeTeam, game.awayTeam].filter(Boolean);
    dayEntry.teamsPlaying = Array.from(new Set([...dayEntry.teamsPlaying, ...teams]));

    teams.forEach((team) => {
      if (!teamGameMap[team]) {
        teamGameMap[team] = [];
      }
      teamGameMap[team].push(game);
    });
  });

  // Sort daily entries chronologically
  const daily = Array.from(dailyMap.values()).sort((a, b) => (a.date > b.date ? 1 : -1));

  // Ensure team map entries are sorted by tipoff time
  Object.values(teamGameMap).forEach((teamGames) => {
    teamGames.sort((a, b) => (a.tipoffUTC > b.tipoffUTC ? 1 : -1));
  });

  return { daily, teamGameMap };
};
