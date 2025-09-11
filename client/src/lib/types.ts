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
  currentPlayerName?: string; // name of player currently in that slot
};

export type PosStrength = {
  pos: string;
  demand: number;          // how many of this pos you actually start (from optimal lineup)
  startersProj: number;    // sum of projections for starters at this pos
  depthProjWeighted: number; // weighted bench quality (diminishing returns)
  replacementBaseline: number; // baseline per-starter from FA pool
  surplus: number;         // startersProj - demand * replacementBaseline
  shortage: number;        // max(0, demand*replacementBaseline - startersProj)
  tiers: { label: string; name: string; proj: number }[]; // elite/starter/flex/depth/repl
};

export type RosterHealth = {
  byPos: PosStrength[];
  strongest: string[];
  weakest: string[];
  tradeIdeas: { give: string; forNeed: string; rationale: string }[];
  addDropIdeas: { pos: string; addName: string; gain: number; dropName?: string }[];
};

export type LeagueSummary = {
  league_id: string;
  name: string;
  roster_positions: string[]; // from Sleeper: e.g. ["QB","RB","RB","WR","WR","TE","FLEX","FLEX","K","DEF","BN","BN"...]
  starters: (string | null)[]; // current starters (player_ids) in slot order per Sleeper, null = empty slot
  bench: string[];            // bench player_ids
  rosterUserDisplay: string;  // the team/owner display name
  optimalSlots: RosterSlot[]; // computed optimal starters
  optimalTotal: number;       // sum of proj
  currentTotal: number;       // sum of proj of current starters
  delta: number;              // optimal - current
  waiverSuggestions?: WaiverSuggestion[]; // sorted by gain desc
  starterObjs?: (PlayerLite & { proj?: number; opp?: string })[]; // enriched starter objects
  allEligible?: (PlayerLite & { proj?: number; opp?: string })[]; // all eligible players for lookup
  benchCapacity: number;   // how many BN slots the league has
  benchCount: number;      // how many players currently on BN (excl. IR/Taxi)
  benchEmpty: number;      // benchCapacity - benchCount (min 0)
  benchDetail?: { player_id: string; name: string; pos: string; proj: number }[]; // compact bench for health module
  rosterHealth?: RosterHealth; // roster strength analysis
};
