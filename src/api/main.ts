import { sleeperClient } from './api';

export const getUserDataWithUserId = (userId: string) => {
    return sleeperClient.get(`/user/${userId}`)
}

export const getUserDataWithUsername = (username: string) => {
    return sleeperClient.get(`/user/${username}`)
}

// Get leagues for a user for a given sport and season.
// Example: GET https://api.sleeper.app/v1/user/<user_id>/leagues/basketball/2025
export const getUserLeaguesForUser = (userId: string | number, sport = 'basketball', season?: string) => {
    const seasonStr = season ?? String(new Date().getFullYear());
    return sleeperClient.get(`/user/${userId}/leagues/${sport}/${seasonStr}`);
}

// Get a specific league by id
export const getLeagueById = (leagueId: string) => {
    return sleeperClient.get(`/league/${leagueId}`);
}

// Get rosters for a league
// Example: GET https://api.sleeper.app/v1/league/<league_id>/rosters
export const getLeagueRosters = (leagueId: string) => {
    return sleeperClient.get(`/league/${leagueId}/rosters`);
}

// Get users in a league
// Example: GET https://api.sleeper.app/v1/league/<league_id>/users
export const getLeagueUsers = (leagueId: string) => {
    return sleeperClient.get(`/league/${leagueId}/users`);
}

// Get all NBA players
// Example: GET https://api.sleeper.app/v1/players/nba
export const getPlayersNBA = () => {
    return sleeperClient.get(`/players/nba`);
}
