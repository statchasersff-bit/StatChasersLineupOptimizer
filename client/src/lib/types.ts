export type Projection = {
  sleeper_id?: string;
  name: string;
  team?: string;
  pos: string;   // QB/RB/WR/TE/K/DEF
  proj: number;  // projected points (StatChasers weekly)
  opp?: string;  // 'BYE' to flag bye
  stats?: Record<string, number>; // stat-level projections for league-specific scoring
};

export type PlayerLite = {
  player_id: string;   // Sleeper player_id
  name: string;
  team?: string;
  pos: string;         // primary fantasy position
  multiPos: string[];  // fantasy_positions array
  injury_status?: string; // OUT/DOUBTFUL/SUSPENDED/etc
};

export type RosterSlot = {
  slot: string;        // QB, RB, WR, TE, FLEX, SUPER_FLEX, K, DEF
  player?: PlayerLite & { proj?: number; opp?: string };
};

export type WaiverSuggestion = {
  player_id: string;
  name: string;
  team?: string;
  pos: string;
  proj: number;        // league-scored projection
  opp?: string;
  replaceSlot: string; // which slot they would fill
  gain: number;        // points gained over your current optimal for that slot
};

export type LeagueSummary = {
  league_id: string;
  name: string;
  roster_positions: string[]; // from Sleeper: e.g. ["QB","RB","RB","WR","WR","TE","FLEX","FLEX","K","DEF","BN","BN"...]
  starters: string[];         // current starters (player_ids) in slot order per Sleeper
  bench: string[];            // bench player_ids
  rosterUserDisplay: string;  // the team/owner display name
  optimalSlots: RosterSlot[]; // computed optimal starters
  optimalTotal: number;       // sum of proj
  currentTotal: number;       // sum of proj of current starters
  delta: number;              // optimal - current
  waiverSuggestions?: WaiverSuggestion[]; // sorted by gain desc
};
