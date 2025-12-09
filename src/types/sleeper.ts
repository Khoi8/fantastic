/**
 * Sleeper API Types
 * Based on https://docs.sleeper.com/
 */

/**
 * User object from Sleeper API
 * GET /user/<username> or /user/<user_id>
 */
export interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar?: string | null;
}

/**
 * League User object (user in a league with metadata)
 * GET /league/<league_id>/users
 */
export interface LeagueUser extends SleeperUser {
  metadata?: {
    team_name?: string;
    [key: string]: any;
  };
  is_owner?: boolean;
}

/**
 * League settings object with detailed configuration
 */
export interface LeagueSettings {
  reserve_allow_dtd?: number;
  last_report?: number;
  waiver_budget?: number;
  disable_adds?: number;
  capacity_override?: number;
  taxi_deadline?: number;
  draft_rounds?: number;
  reserve_allow_na?: number;
  start_week?: number;
  playoff_seed_type?: number;
  playoff_teams?: number;
  num_teams?: number;
  daily_waivers_hour?: number;
  playoff_type?: number;
  taxi_slots?: number;
  last_scored_leg?: number;
  daily_waivers_days?: number;
  playoff_week_start?: number;
  waiver_clear_days?: number;
  waiver_after_game_start?: number;
  reserve_allow_doubtful?: number;
  commissioner_direct_invite?: number;
  reserve_allow_dnr?: number;
  taxi_allow_vets?: number;
  waiver_day_of_week?: number;
  playoff_round_type?: number;
  reserve_allow_out?: number;
  reserve_allow_sus?: number;
  trade_deadline?: number;
  taxi_years?: number;
  daily_waivers?: number;
  game_mode?: number;
  pick_trading?: number;
  type?: number;
  max_keepers?: number;
  waiver_type?: number;
  league_average_match?: number;
  trade_review_days?: number;
  bench_lock?: number;
  offseason_adds?: number;
  leg?: number;
  reserve_slots?: number;
  reserve_allow_cov?: number;
  daily_waivers_last_ran?: number;
  [key: string]: any;
}

/**
 * League scoring settings (points per stat)
 */
export interface ScoringSettings {
  ast?: number;
  blk?: number;
  bonus_ast_15p?: number;
  bonus_pt_40p?: number;
  bonus_pt_50p?: number;
  bonus_reb_20p?: number;
  dd?: number;
  ff?: number;
  pts?: number;
  reb?: number;
  stl?: number;
  td?: number;
  tf?: number;
  to?: number;
  tpm?: number;
  [key: string]: any;
}

/**
 * League metadata object
 */
export interface LeagueMetadata {
  auto_continue?: string;
  keeper_deadline?: string;
  [key: string]: any;
}

/**
 * League object
 * GET /user/<user_id>/leagues/<sport>/<season>
 * GET /league/<league_id>
 */
export interface League {
  league_id: string;
  name: string;
  avatar?: string | null;
  sport: string;
  status: 'pre_draft' | 'drafting' | 'in_season' | 'complete';
  season: string;
  season_type: string;
  total_rosters: number;
  settings?: LeagueSettings;
  scoring_settings?: ScoringSettings;
  roster_positions?: string[];
  metadata?: LeagueMetadata;
  draft_id?: string | null;
  previous_league_id?: string | null;
  company_id?: string | null;
  shard?: number;
  last_message_id?: string | null;
  last_author_avatar?: string | null;
  last_author_display_name?: string;
  last_author_id?: string;
  last_author_is_bot?: boolean;
  last_message_attachment?: any;
  last_message_text_map?: any;
  last_message_time?: number;
  last_pinned_message_id?: string | null;
  last_read_id?: string | null;
  group_id?: string | null;
  bracket_id?: string | null;
  bracket_overrides_id?: string | null;
  loser_bracket_id?: string | null;
  loser_bracket_overrides_id?: string | null;
  [key: string]: any;
}

/**
 * Roster settings (wins, losses, points, etc.)
 */
export interface RosterSettings {
  wins?: number;
  losses?: number;
  ties?: number;
  fpts?: number;
  fpts_decimal?: number;
  fpts_against?: number;
  fpts_against_decimal?: number;
  waiver_position?: number;
  waiver_budget_used?: number;
  total_moves?: number;
  [key: string]: any;
}

/**
 * Roster object
 * GET /league/<league_id>/rosters
 */
export interface Roster {
  roster_id: number;
  owner_id: string;
  league_id: string;
  players?: string[];
  reserve?: string[];
  starters?: string[];
  settings?: RosterSettings;
  name?: string;
  [key: string]: any;
}

/**
 * API Response wrapper
 */
export interface ApiResponse<T = any> {
  data: T;
  status?: number;
}

// --- RAW DATA TYPES ---

/**
 * Represents the raw stats object for a single player returned by the API.
 * Includes explicit fields for "Impact" calculations and a catch-all for others.
 */
export interface PlayerStats {
  // Core Info
  gp: number;                // Games Played
  player_name?: string;      // Sleeper often puts name here
  first_name?: string;       // Yahoo/Others might split it
  last_name?: string;
  
  // Stats required for Impact Calculations
  fgm?: number;              // Field Goals Made
  fga?: number;              // Field Goals Attempted
  ftm?: number;              // Free Throws Made
  fta?: number;              // Free Throws Attempted
  fg3m?: number;             // 3PT Made
  fg3a?: number;             // 3PT Attempted
  
  // Dynamic access for other stats (pts, reb, ast, etc.)
  [key: string]: string | number | undefined; 
}

/**
 * A dictionary mapping Player IDs to their stats object.
 * Key: Player ID (string)
 * Value: PlayerStats object
 */
export interface AllStats {
  [playerId: string]: PlayerStats;
}

/**
 * Represents a single team's roster in the league (calculated/derived data).
 */
export interface TeamRoster {
  roster_id?: number;        // Optional: specific to your app
  owner_id?: string;         // Optional: specific to your app
  players: string[];         // Array of Player IDs on this team
}


// --- CALCULATED RESULT TYPES ---

/**
 * The calculated Z-Score data for a single player.
 */
export interface PlayerZScore {
  name: string;              // Resolved player name
  scores: {                  // Breakdown of Z-scores per category
    [category: string]: number; 
  };
  totalZ: number;            // Sum of all weighted Z-scores
}

/**
 * The final output object mapping Player IDs to their Z-Score data.
 */
export interface PlayerZScores {
  [playerId: string]: PlayerZScore;
}
