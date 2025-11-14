import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { ChartLine, Settings, Search, Users, TrendingUp, AlertTriangle, FileSpreadsheet, Download, Share, Code, ChevronDown, Table as TableIcon, Info, Loader2, Trophy, Flame, XCircle, HelpCircle, Target, Filter, ArrowUpDown, X, Check, RotateCcw } from "lucide-react";
import { getUserByName, getUserLeagues, getLeagueRosters, getLeagueUsers, getLeagueDetails, getLeagueMatchups, getPlayersIndex, getLeagueMatchupsForLocking } from "@/lib/sleeper";
import { buildProjectionIndex, normalizePos } from "@/lib/projections";
import { buildSlotCounts, toPlayerLite, optimizeLineup, optimizeLineupWithLockComparison, sumProj, statusFlags, buildBenchRecommendations, deriveRowState, buildThreeTierOptimization } from "@/lib/optimizer";
import { isPlayerLocked, getWeekSchedule, isTeamOnBye, type GameSchedule } from "@/lib/gameLocking";
import { filterLeagues } from "@/lib/leagueFilters";
import { scoreByLeague } from "@/lib/scoring";
import { buildFreeAgentPool, getOwnedPlayerIds } from "@/lib/freeAgents";
import { loadBuiltInOrSaved, findLatestWeek } from "@/lib/builtin";
import { saveProjections, loadProjections } from "@/lib/storage";
import { getLeagueAutoSubConfig, findAutoSubRecommendations } from "@/lib/autoSubs";
import { detectGlobalAutoSubSettings } from "@/lib/autoSubsGlobal";
import { summarizeStarters, type Starter } from "@/lib/availability";
import type { LeagueSummary, Projection, WaiverSuggestion, RosterSlot } from "@/lib/types";

// Error function (erf) approximation using Abramowitz and Stegun formula
function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  
  return sign * y;
}

// Calculate win probability using Normal distribution model
// Models each team score as Normal random variable with historical volatility
function calculateWinProbability(pointDifferential: number, myStd = 25, oppStd = 25, rho = 0): number {
  // μ = my projected total - opponent projected total (passed as pointDifferential)
  const mu = pointDifferential;
  
  // σ = √(σ₁² + σ₂² - 2ρσ₁σ₂)
  // For uncorrelated teams (ρ = 0): σ = √(σ₁² + σ₂²)
  const sigma = Math.sqrt(myStd * myStd + oppStd * oppStd - 2 * rho * myStd * oppStd);
  
  // Calculate z-score
  const z = mu / (sigma || 1e-6);
  
  // Standard normal CDF: Φ(z) = 0.5 * (1 + erf(z / √2))
  const SQRT2 = Math.sqrt(2);
  const phi = 0.5 * (1 + erf(z / SQRT2));
  
  // Convert to percentage and clamp between 1-99%
  const winProb = Math.max(0, Math.min(1, phi)) * 100;
  return Math.max(1, Math.min(99, Math.round(winProb)));
}
import { motion, AnimatePresence } from "framer-motion";
import LeagueCard from "@/components/LeagueCard";
import { LeagueListSkeleton } from "@/components/ui/league-skeleton";
import { AutoSubBanner } from "@/components/ui/auto-sub-chip";
import AdminModal from "@/components/AdminModal";
import { BrandLogo } from "@/components/BrandLogo";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import { ShareSummaryCard } from "@/components/ShareSummaryCard";
import { useToast } from "@/hooks/use-toast";
import { MobileStickyFooter } from "@/components/MobileStickyFooter";
import { PersistentBackBar } from "@/components/PersistentBackBar";
import { StatChasersLoader } from "@/components/StatChasersLoader";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { StatSummaryCard } from "@/components/StatSummaryCard";
import { useStatTrends } from "@/hooks/use-stat-trends";

export default function Home() {
  const [, setLocation] = useLocation();
  const params = useParams<{ username?: string }>();
  
  // Load saved settings from localStorage
  const loadSetting = <T,>(key: string, defaultValue: T): T => {
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return defaultValue;
      }
    }
    return defaultValue;
  };
  
  const [season, setSeason] = useState(() => loadSetting('statChasers_season', "2025"));
  const [week, setWeek] = useState<string>(""); // Will be auto-detected
  const [username, setUsername] = useState(() => params.username || loadSetting('statChasers_username', ""));
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [playersIndex, setPlayersIndex] = useState<Record<string, any> | null>(null);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [summaries, setSummaries] = useState<LeagueSummary[]>([]);
  const [considerWaivers, setConsiderWaivers] = useState(() => loadSetting('statChasers_considerWaivers', true));
  const [oppOptimal, setOppOptimal] = useState(() => loadSetting('statChasers_oppOptimal', true));
  const [filterDynasty, setFilterDynasty] = useState(() => loadSetting('statChasers_filterDynasty', false));
  const [filterNonOptimal, setFilterNonOptimal] = useState(() => loadSetting('statChasers_filterNonOptimal', false));
  const [sortAlphabetical, setSortAlphabetical] = useState(false);
  const [sortBy, setSortBy] = useState<'delta' | 'winProbability' | 'injuries' | 'alphabetical'>(() => loadSetting('statChasers_sortBy', 'delta'));
  const [filterInjuries, setFilterInjuries] = useState(() => loadSetting('statChasers_filterInjuries', false));
  const [filterBigDelta, setFilterBigDelta] = useState(() => loadSetting('statChasers_filterBigDelta', false));
  const [usingSavedMsg, setUsingSavedMsg] = useState<string | null>(null);
  const [projections, setProjections] = useState<Projection[]>([]);
  const [totalLeagues, setTotalLeagues] = useState(0);
  const [loadedLeagues, setLoadedLeagues] = useState(0);
  const [checkedLeagues, setCheckedLeagues] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('checkedLeagues');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });
  const [currentLeagueIndex, setCurrentLeagueIndex] = useState(0);
  const [showPersistentBackBar, setShowPersistentBackBar] = useState(false);
  const { toast } = useToast();
  
  // Refs array for league cards to enable smooth scrolling on mobile
  const leagueCardRefs = React.useRef<(HTMLDivElement | null)[]>([]);

  // Helper function to scroll to a specific league card with sticky UI offset
  const scrollToLeague = (index: number) => {
    const element = leagueCardRefs.current[index];
    if (element) {
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementPosition - 220; // Adjust for sticky header + padding
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    } else {
      // Fallback if ref is missing
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Track scroll position for persistent back bar
  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 300;
      setShowPersistentBackBar(scrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Persist user settings to localStorage
  useEffect(() => {
    localStorage.setItem('statChasers_username', JSON.stringify(username));
  }, [username]);
  
  useEffect(() => {
    localStorage.setItem('statChasers_season', JSON.stringify(season));
  }, [season]);
  
  useEffect(() => {
    localStorage.setItem('statChasers_considerWaivers', JSON.stringify(considerWaivers));
  }, [considerWaivers]);
  
  useEffect(() => {
    localStorage.setItem('statChasers_oppOptimal', JSON.stringify(oppOptimal));
  }, [oppOptimal]);
  
  useEffect(() => {
    localStorage.setItem('statChasers_filterDynasty', JSON.stringify(filterDynasty));
  }, [filterDynasty]);
  
  useEffect(() => {
    localStorage.setItem('statChasers_filterNonOptimal', JSON.stringify(filterNonOptimal));
  }, [filterNonOptimal]);
  
  useEffect(() => {
    localStorage.setItem('statChasers_sortBy', JSON.stringify(sortBy));
  }, [sortBy]);
  
  useEffect(() => {
    localStorage.setItem('statChasers_filterInjuries', JSON.stringify(filterInjuries));
  }, [filterInjuries]);
  
  useEffect(() => {
    localStorage.setItem('statChasers_filterBigDelta', JSON.stringify(filterBigDelta));
  }, [filterBigDelta]);
  
  // Persist checked leagues to localStorage
  useEffect(() => {
    localStorage.setItem('checkedLeagues', JSON.stringify(Array.from(checkedLeagues)));
  }, [checkedLeagues]);

  // Auto-detect the latest available week on mount
  useEffect(() => {
    (async () => {
      const latestWeek = await findLatestWeek(season);
      setWeek(String(latestWeek));
      console.log(`[Home] Auto-detected latest week: ${latestWeek}`);
    })();
  }, [season]);

  // Built-in projections loader
  useEffect(() => {
    // Don't load projections until week is auto-detected
    if (!week) return;
    
    (async () => {
      console.log(`[Home] Loading projections for season=${season}, week=${week}`);
      const got = await loadBuiltInOrSaved({
        season, week,
        loadSaved: loadProjections,
        saveSaved: saveProjections,
        setProjections,
        setProjIdx: () => {}, // Will be handled by projIdx useMemo
        setBanner: setUsingSavedMsg
      });
      if (!got) {
        // no built-in & nothing saved: user can upload manually
        setProjections([]);
        setUsingSavedMsg(null);
        console.log(`[Home] No projections found, setting empty state`);
      }
    })();
  }, [season, week]);

  // Debug projections state changes
  useEffect(() => {
    console.log(`[Home] Projections state updated: ${projections.length} projections available`);
    if (projections.length > 0) {
      console.log(`[Home] Sample projection:`, projections[0]);
    }
  }, [projections]);

  const projIdx = useMemo(() => {
    return buildProjectionIndex(projections);
  }, [projections]);

  // Re-sort and filter summaries
  const sortedSummaries = useMemo(() => {
    let filtered = summaries;
    
    // Filter non-optimal lineups using rowState
    // A league is only optimal if rowState is 'OPTIMAL'
    // Leagues with OUT/BYE/EMPTY, bench improvements, or waiver opportunities are non-optimal
    if (filterNonOptimal) {
      filtered = filtered.filter(s => s.rowState !== 'OPTIMAL');
    }
    
    // Filter by injuries (3+)
    if (filterInjuries) {
      filtered = filtered.filter(s => (s.outByeEmptyCount || 0) + (s.quesCount || 0) >= 3);
    }
    
    // Filter by big delta (5+ pts)
    // Use achievableDelta (lock-aware) if available, fallback to delta
    if (filterBigDelta) {
      filtered = filtered.filter(s => (s.achievableDelta ?? s.delta) >= 5);
    }
    
    // Sort based on selected option
    let sorted = [...filtered];
    switch (sortBy) {
      case 'alphabetical':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'winProbability':
        sorted.sort((a, b) => {
          const aProb = a.winProbability ?? 0;
          const bProb = b.winProbability ?? 0;
          return bProb - aProb; // Highest win% first
        });
        break;
      case 'injuries':
        sorted.sort((a, b) => {
          const aInjuries = (a.outByeEmptyCount || 0) + (a.quesCount || 0);
          const bInjuries = (b.outByeEmptyCount || 0) + (b.quesCount || 0);
          return bInjuries - aInjuries; // Most injuries first
        });
        break;
      case 'delta':
      default:
        sorted.sort((a, b) => b.delta - a.delta); // Biggest delta first
        break;
    }
    
    return sorted;
  }, [summaries, sortBy, filterNonOptimal, filterInjuries, filterBigDelta]);

  // Clamp currentLeagueIndex when sortedSummaries changes (filters applied, etc.)
  useEffect(() => {
    if (currentLeagueIndex >= sortedSummaries.length && sortedSummaries.length > 0) {
      setCurrentLeagueIndex(sortedSummaries.length - 1);
    }
  }, [sortedSummaries.length, currentLeagueIndex]);

  const handleAnalyzeLineups = async () => {
    if (!username.trim()) {
      toast({ title: "Error", description: "Please enter a Sleeper username", variant: "destructive" });
      return;
    }

    if (projections.length === 0) {
      toast({ title: "Error", description: "No projections available for this week", variant: "destructive" });
      return;
    }

    // Additional validation to ensure projections have valid numbers
    const validProjections = projections.filter(p => 
      p && typeof p.proj === 'number' && isFinite(p.proj) && p.proj >= 0
    );
    
    if (validProjections.length === 0) {
      toast({ title: "Error", description: "No valid projections found (all projections are NaN or invalid)", variant: "destructive" });
      return;
    }

    if (validProjections.length < projections.length) {
      console.warn(`[Home] Found ${projections.length - validProjections.length} invalid projections out of ${projections.length} total`);
    }

    setIsAnalyzing(true);
    try {
      console.log(`[Home] Looking up user: "${username.trim()}"`);
      const user = await getUserByName(username.trim());
      console.log(`[Home] getUserByName result:`, user);
      
      if (!user || !user.user_id) {
        console.log(`[Home] User not found or missing user_id`);
        toast({ title: "Error", description: `User "${username.trim()}" not found on Sleeper`, variant: "destructive" });
        setIsAnalyzing(false);
        return;
      }
      
      console.log(`[Home] Valid user found with ID: ${user.user_id}`);
      const lgs = await getUserLeagues(user.user_id, season);
      console.log(`[Home] Found ${lgs.length} total leagues from Sleeper API`);
      
      // Additional check: if user exists but has 0 leagues, this might be normal
      // However, for completely fake usernames, we should catch this earlier

      // Use centralized filtering logic (always exclude Best Ball, optionally exclude Dynasty/Keeper)
      const filterResult = filterLeagues(lgs, {
        excludeBestBall: true,
        excludeDynasty: filterDynasty
      });
      
      const filteredLeagues = filterResult.filtered;
      
      // Log filtering results
      if (filterResult.counts.bestBallExcluded > 0) {
        console.log(`[Home] Filtered out ${filterResult.counts.bestBallExcluded} Best Ball leagues`);
      }
      if (filterResult.counts.dynastyExcluded > 0) {
        console.log(`[Home] Filtered out ${filterResult.counts.dynastyExcluded} Dynasty leagues`);
      }
      console.log(`[Home] Processing ${filteredLeagues.length} leagues after filtering`);
      setLeagues(filteredLeagues);
      
      // Set total leagues count for progress tracking
      setTotalLeagues(filteredLeagues.length);
      setLoadedLeagues(0); // Reset counter
      
      if (!playersIndex) {
        const idx = await getPlayersIndex();
        setPlayersIndex(idx);
      }

      // Process each league
      const out: LeagueSummary[] = [];
      const currentPlayersIndex = playersIndex || await getPlayersIndex();

      // Fetch game schedule once for all leagues
      const schedule = await getWeekSchedule(season, week);

      for (const lg of filteredLeagues) {
        try {
          const [rosters, users, leagueDetails, matchups] = await Promise.all([
            getLeagueRosters(lg.league_id),
            getLeagueUsers(lg.league_id),
            getLeagueDetails(lg.league_id),
            getLeagueMatchups(lg.league_id, week),
          ]);
          
          // Fetch matchup data for THIS league only to get correct actual points per league's scoring
          const { playedPlayerIds, actualPoints } = await getLeagueMatchupsForLocking([lg.league_id], week);

          // Find user's roster
          const meRoster = rosters.find((r: any) => r.owner_id === user.user_id) || 
                          rosters.find((r: any) => r.owner_id === lg.user_id) || 
                          rosters.find((r: any) => r.roster_id === lg.roster_id) || 
                          rosters[0];
          
          // Skip leagues where user has fewer than 3 rostered players
          const totalPlayers = (meRoster?.players || []).length;
          if (totalPlayers < 3) {
            console.log(`Skipping league ${lg.name} - only ${totalPlayers} players rostered`);
            continue;
          }
          
          const owner = users.find((u: any) => u.user_id === meRoster?.owner_id);
          const display = owner?.metadata?.team_name || owner?.display_name || "Unknown Manager";

          const roster_positions: string[] = leagueDetails?.roster_positions || lg.roster_positions || [];
          const slotCounts = buildSlotCounts(roster_positions);

          // Use matchup starters (reflects in-week changes & auto-subs) over roster starters
          const meMatchup = matchups?.find((m: any) => m.roster_id === meRoster?.roster_id);
          const actualStarters = (meMatchup && meMatchup.starters && meMatchup.starters.length > 0) 
            ? meMatchup.starters 
            : (meRoster?.starters || []);
          
          // Keep original starter structure (including empty slots) for display
          const starters: (string | null)[] = actualStarters;
          // For bench calculation, filter out empties and get non-starting players
          const validStarters = starters.filter((x): x is string => !!x);
          const bench: string[] = (meRoster?.players || []).filter((p: string) => p && !validStarters.includes(p));

          // Get league scoring settings from detailed league data
          const scoring = (leagueDetails?.scoring_settings) || {};
          
          // Debug: Log scoring settings for first league
          if (out.length === 0) {
            console.log("League scoring settings sample:", {
              rec: scoring.rec || "not set",
              pass_yd: scoring.pass_yd || "not set", 
              rush_yd: scoring.rush_yd || "not set",
              rec_yd: scoring.rec_yd || "not set"
            });
          }

          // Build enriched player list with league-adjusted projections
          const addWithProj = (pid: string) => {
            const lite = toPlayerLite(currentPlayersIndex, pid);
            if (!lite) return null;
            const pr = projIdx[pid] || projIdx[`${lite.name.toLowerCase()}|${lite.team ?? ""}|${lite.pos}`];

            // derive league-adjusted projection
            let adj = 0;
            if (pr) {
              const stats = (pr as any)?.stats || {};
              const originalProj = pr.proj;
              
              adj = scoreByLeague(lite.pos, stats, scoring, pr.proj);
              
            } else {
              adj = 0; // no projection found
            }

            // Check if player is OUT and set projection to 0
            const flags = statusFlags({ ...lite, proj: adj, opp: pr?.opp });
            const isOut = flags.includes("OUT");
            const finalProj = isOut ? 0 : adj;
            
            // Check if player is locked (team already played or has played in matchup)
            const locked = isPlayerLocked(lite, schedule, Date.now(), playedPlayerIds);
            
            // Use actual points if available and player is locked
            const actual = actualPoints[pid];
            const displayProj = (locked && actual !== undefined) ? actual : finalProj;
            
            // Determine opponent - if missing from projections, check if team is on BYE
            let opp = pr?.opp;
            if (!opp && lite.team) {
              opp = isTeamOnBye(lite.team, schedule) ? "BYE" : undefined;
            }
            
            return { ...lite, proj: displayProj, opp, locked, actualPoints: actual };
          };

          const starterObjs = validStarters.map(addWithProj).filter(Boolean) as any[];
          const benchObjs = bench.map(addWithProj).filter(Boolean) as any[];
          
          // Include IR players if they're healthy (not OUT/injured)
          const irList: string[] = (meRoster?.reserve || []).filter(Boolean);
          const irObjs = irList.map(addWithProj).filter(Boolean) as any[];
          // Only include IR players who are healthy enough to play (not OUT)
          const healthyIRObjs = irObjs.filter((p: any) => {
            const flags = statusFlags(p);
            return !flags.includes("OUT");
          });
          
          // Build roster pool (no FAs) - tier 1 and tier 2 use roster only
          const rosterPlayers = [...starterObjs, ...benchObjs, ...healthyIRObjs];

          // Fetch free agents if enabled (for tier 3)
          let freeAgents: any[] = [];
          if (considerWaivers) {
            try {
              const { buildFACandidates } = await import("@/lib/faIntegration");
              const owned = new Set<string>();
              rosters.forEach((roster: any) => {
                (roster.players || []).forEach((pid: string) => owned.add(pid));
              });

              freeAgents = await buildFACandidates(owned, currentPlayersIndex, projIdx, scoring, schedule, playedPlayerIds);
            } catch (err) {
              console.error("[FA Integration] Error fetching free agents:", err);
            }
          }

          // THREE-TIER OPTIMIZATION: current → bench optimal (roster) → waiver optimal (roster + FAs)
          const threeTierResult = buildThreeTierOptimization({
            slotCounts,
            rosterPlayers,
            freeAgents,
            season,
            week,
            currentStarters: starters
          });

          const {
            currentSlots,
            currentTotal,
            benchOptimalSlots,
            benchOptimalTotal,
            deltaBench,
            waiverOptimalSlots,
            waiverOptimalTotal,
            deltaWaiver,
            hasLockedPlayers,
            fullBenchOptimalTotal,
            fullWaiverOptimalTotal
          } = threeTierResult;

          // Extract fixed slots for later use
          const fixedSlots = roster_positions.filter((s: string) => !["BN","IR","TAXI"].includes(s));

          // Use bench optimal (tier 2) for bench recommendations (roster moves only, no FAs)
          // Display waiver optimal (tier 3) as "optimal" in UI when FAs enabled
          const optimalSlots = considerWaivers ? waiverOptimalSlots : benchOptimalSlots;
          const optimalTotal = considerWaivers ? waiverOptimalTotal : benchOptimalTotal;
          const fullOptimalTotal = considerWaivers 
            ? (fullWaiverOptimalTotal ?? waiverOptimalTotal)
            : (fullBenchOptimalTotal ?? benchOptimalTotal);

          // Build bench → starter recommendations using BENCH optimal (tier 2, roster-only)
          // This ensures bench recommendations only suggest roster moves, not FA adds
          const {
            recommendations: benchRecommendations,
            filteredRecommendations: filteredBenchRecs,
            blockedRecommendations: blockedBenchRecs,
            blockedDelta,
            lockedPlayerIds
          } = buildBenchRecommendations(
            currentSlots,
            benchOptimalSlots, // Use tier 2 (bench optimal), not tier 3
            validStarters,
            rosterPlayers, // Use roster only, not roster + FAs
            irList
          );

          // Build FA pool once per league (owned derived from league rosters)
          let waiverSuggestions: WaiverSuggestion[] = [];
          if (considerWaivers) {
            const owned = getOwnedPlayerIds(rosters);

            // Build a pool of candidate FAs limited per position for perf
            const faByPos = buildFreeAgentPool({
              playersIndex: currentPlayersIndex,
              owned,
              projIdx,
              schedule,
              playedPlayerIds, // Pass the played player data for enhanced locking
            });

            // Score the FA pool using league scoring (teams that have played are already filtered out)
            const scoredFAs: Record<string, { player_id: string; name: string; team?: string; pos: string; proj: number; opp?: string }[]> = {};
            for (const pos of Object.keys(faByPos)) {
              scoredFAs[pos] = faByPos[pos]
                .map((fa) => {
                  // look up full projection row by id (for stat-level)
                  const pr = projIdx[fa.player_id];
                  const stats = (pr as any)?.stats || {};
                  const adj = scoreByLeague(pos, stats, scoring, pr?.proj ?? fa.proj);
                  return { ...fa, proj: adj };
                }).sort((a, b) => (b.proj ?? 0) - (a.proj ?? 0));
            }

            // For each starting slot, see if the best eligible FA beats your CURRENT player
            // 1) map slot → current starter's projection (handle multiple slots of same type)
            const slotToCurrent: Record<string, { proj: number; name?: string }> = {};
            const slotCounts: Record<string, number> = {};
            
            currentSlots.forEach((s, index) => {
              const slotType = s.slot;
              slotCounts[slotType] = (slotCounts[slotType] || 0) + 1;
              const uniqueSlotKey = slotCounts[slotType] > 1 ? `${slotType}_${slotCounts[slotType]}` : slotType;
              
              if (s.player) {
                slotToCurrent[uniqueSlotKey] = { proj: s.player.proj ?? 0, name: s.player.name };
              } else {
                slotToCurrent[uniqueSlotKey] = { proj: 0, name: "[EMPTY]" };
              }
            });

            // 2) eligibility for flex slots mirrors your optimizer
            const FLEX_ELIG: Record<string, string[]> = {
              FLEX: ["RB","WR","TE"],
              WRT: ["RB","WR","TE"],
              WRTQ: ["RB","WR","TE","QB"],
              SUPER_FLEX: ["QB","RB","WR","TE"],
              REC_FLEX: ["WR","TE"],
              RB_WR: ["RB","WR"],
              RB_WR_TE: ["RB","WR","TE"],
            };
            const isFlex = (slot: string) => Boolean(FLEX_ELIG[slot.toUpperCase()]);
            const canFill = (slot: string, pos: string) => {
              // Handle unique slot keys (e.g., "FLEX_2" -> "FLEX")
              const baseSlot = slot.split('_')[0].toUpperCase();
              const p = pos.toUpperCase();
              if (isFlex(baseSlot)) return (FLEX_ELIG[baseSlot] || []).includes(p);
              return baseSlot === p;
            };

            // 3) For each slot type in your starting lineup, find best FA eligible
            const seen: Record<string, boolean> = {};
            const currentIds = new Set(currentSlots.map(s => s.player?.player_id).filter(Boolean) as string[]);
            
            for (const slot of Object.keys(slotToCurrent)) {
              let bestFA: any = null;

              // Collect ALL eligible candidates across all positions first, then pick highest projected
              const eligibleCandidates: any[] = [];
              
              for (const pos of Object.keys(scoredFAs)) {
                if (!canFill(slot, pos)) continue;
                for (const cand of scoredFAs[pos]) {
                  const key = cand.player_id;
                  if (seen[key]) continue;
                  if (currentIds.has(cand.player_id)) continue;
                  eligibleCandidates.push(cand);
                }
              }
              
              // Now pick the candidate with the highest projection
              if (eligibleCandidates.length > 0) {
                bestFA = eligibleCandidates.reduce((best, current) => 
                  (current.proj ?? 0) > (best.proj ?? 0) ? current : best
                );
              }


              if (bestFA) {
                const currentInfo = slotToCurrent[slot];
                const current = currentInfo.proj;
                const gain = (bestFA.proj ?? 0) - current;
                if (gain > 0.2) { // small threshold to avoid noise
                  // Use display-friendly slot name (remove unique suffix)
                  const displaySlot = slot.split('_')[0];
                  waiverSuggestions.push({
                    player_id: bestFA.player_id,
                    name: bestFA.name,
                    team: bestFA.team,
                    pos: bestFA.pos,
                    proj: bestFA.proj,
                    opp: bestFA.opp,
                    replaceSlot: displaySlot,
                    gain,
                    currentPlayerName: currentInfo.name, // Add current player name for display
                  });
                  seen[bestFA.player_id] = true;
                }
              }
            }

            waiverSuggestions.sort((a, b) => b.gain - a.gain);
            
            
            
          }

          // Calculate bench capacity and empty spots
          // Identify Taxi players (don't count them toward BN) - irList already defined above
          const taxiList: string[] = (meRoster?.taxi || []).filter(Boolean);
          
          // All rostered players on the team
          const allPlayers: string[] = (meRoster?.players || []).filter(Boolean);
          
          // Bench = rostered players not currently starting and not on IR/Taxi
          const benchActual: string[] = allPlayers.filter(
            (pid) => !validStarters.includes(pid) && !irList.includes(pid) && !taxiList.includes(pid)
          );
          
          // Bench capacity = number of BN slots defined by league settings
          const benchCapacity = roster_positions.filter((s) => s === "BN").length;
          
          // Current bench count
          const benchCount = benchActual.length;
          
          // Empty bench slots (never negative)
          const benchEmpty = Math.max(0, benchCapacity - benchCount);

          // Get auto-sub configuration for this league
          const autoSubConfig = await getLeagueAutoSubConfig(lg.league_id);
          
          // Generate auto-sub recommendations for questionable starters
          let autoSubRecommendations: any[] = [];
          if (autoSubConfig.enabled) {
            // Create simplified projections map for auto-sub function
            const simpleProjections: Record<string, number> = {};
            for (const [key, proj] of Object.entries(projIdx)) {
              simpleProjections[key] = proj.proj || 0;
            }
            
            autoSubRecommendations = findAutoSubRecommendations({
              starters: starterObjs,
              bench: benchObjs,
              rosterPositions: fixedSlots.filter((s: string) => !["BN","IR","TAXI"].includes(s)),
              projections: simpleProjections,
              requireLaterStart: autoSubConfig.requireLaterStart
            });
          }

          // Process head-to-head matchup analysis
          let opponent: any = undefined;
          let projectedWin: boolean | undefined = undefined;
          let pointDifferential: number | undefined = undefined;
          let winProbability: number | undefined = undefined;

          try {
            // Find user's matchup data based on roster_id
            const userMatchup = matchups?.find((m: any) => m.roster_id === meRoster?.roster_id);
            
            if (userMatchup?.matchup_id) {
              // Find opponent with same matchup_id but different roster_id
              const opponentMatchup = matchups?.find((m: any) => 
                m.matchup_id === userMatchup.matchup_id && m.roster_id !== userMatchup.roster_id
              );
              
              if (opponentMatchup) {
                // Find opponent's roster and user info
                const opponentRoster = rosters.find((r: any) => r.roster_id === opponentMatchup.roster_id);
                const opponentUser = users.find((u: any) => u.user_id === opponentRoster?.owner_id);
                const opponentTeamName = opponentUser?.metadata?.team_name || opponentUser?.display_name || "Unknown Opponent";
                
                // Process opponent's current starters with projections
                const opponentStarters = opponentMatchup.starters || [];
                const opponentCurrentSlots = fixedSlots.map((slot: string, i: number) => {
                  const pid = opponentStarters[i];
                  if (!pid) return { slot }; // Handle empty slots
                  const player = addWithProj(pid);
                  if (!player) return { slot };
                  return { slot, player };
                });
                
                const opponentCurrentTotal = sumProj(opponentCurrentSlots as any);
                
                // Calculate opponent's optimal lineup if using optimal mode
                let opponentOptimalTotal = opponentCurrentTotal;
                if (oppOptimal) {
                  // Get opponent's full roster
                  const oppPlayers = opponentRoster?.players || [];
                  const oppAllEligible = oppPlayers.map((pid: string) => addWithProj(pid)).filter(Boolean);
                  // Calculate opponent's optimal lineup
                  const oppOptimalSlots = optimizeLineup(slotCounts, oppAllEligible, season, week, opponentStarters);
                  opponentOptimalTotal = sumProj(oppOptimalSlots);
                }
                
                // Use the appropriate total based on oppOptimal setting
                const opponentTotal = oppOptimal ? opponentOptimalTotal : opponentCurrentTotal;
                
                // Calculate head-to-head comparison
                pointDifferential = optimalTotal - opponentTotal;
                winProbability = calculateWinProbability(pointDifferential);
                
                if (pointDifferential > 0) {
                  projectedWin = true;
                } else if (pointDifferential < 0) {
                  projectedWin = false;
                } else {
                  projectedWin = undefined; // Tie
                }
                
                opponent = {
                  roster_id: opponentMatchup.roster_id,
                  teamName: opponentTeamName,
                  currentStarters: opponentCurrentSlots,
                  currentTotal: opponentTotal
                };
              }
            }
          } catch (err) {
            console.warn("Failed to process opponent data for league", lg.name, err);
            // Continue without opponent data rather than failing the entire league
          }

          // Calculate availability counts for current starters
          const startersForAvailability: Starter[] = fixedSlots.map((slot: string, i: number) => {
            const pid = starters[i];
            // Treat "0", "", null, or undefined as empty slots
            const validPid = (pid && pid !== "0") ? pid : undefined;
            const player = validPid ? starterObjs.find((p: any) => p.player_id === validPid) : undefined;
            return {
              player_id: validPid,
              name: player?.name,
              opp: player?.opp,
              injury_status: player?.injury_status,
              slot,
              proj: player?.proj,
              pos: player?.pos,
              locked: player?.locked
            };
          });
          const availSummary = summarizeStarters(startersForAvailability);

          // Calculate achievable delta (accounts for locked recommendations)
          const achievableDelta = Math.max(0, optimalTotal - currentTotal - blockedDelta);

          // Build current starters as RosterSlot[] for deriveRowState
          // This allows hasEmpty check to detect empty slots in CURRENT lineup, not optimal
          const currentStarterSlots: RosterSlot[] = fixedSlots.map((slot: string, i: number) => {
            const pid = starters[i];
            const validPid = (pid && pid !== "0") ? pid : null;
            const player = validPid ? starterObjs.find((p: any) => p.player_id === validPid) : null;
            return {
              slot,
              player: player || null
            };
          });

          // Calculate row state using deriveRowState
          // Pass CURRENT starters (not optimal) so hasEmpty and notPlayingCount check the actual lineup
          const rowState = deriveRowState({
            benchOptimalLineup: currentStarterSlots, // Current starters, not optimal lineup
            deltaBench: achievableDelta, // Lock-aware bench delta
            deltaWaiver: deltaWaiver, // Now properly calculated from three-tier optimization!
            pickupsLeft: 999, // TODO: Get from league settings
            freeAgentsEnabled: considerWaivers,
            notPlayingCount: availSummary.notPlayingCount
          });

          out.push({
            league_id: lg.league_id,
            name: lg.name,
            roster_positions: fixedSlots,
            starters,
            bench,
            rosterUserDisplay: display,
            optimalSlots,
            optimalTotal,
            currentTotal,
            delta: optimalTotal - currentTotal,
            achievableDelta, // Lock-aware delta accounting for blocked recommendations
            fullOptimalTotal, // Full optimal ignoring locks (for comparison)
            hasLockedPlayers, // Whether there are any locked players
            rowState, // State from deriveRowState (EMPTY if OUT/BYE/EMPTY players)
            benchOptimalTotal, // Tier 2: optimal from roster only
            waiverOptimalTotal, // Tier 3: optimal from roster + FAs
            waiverSuggestions,
            starterObjs, // Include enriched starter objects with names
            allEligible: considerWaivers ? [...rosterPlayers, ...freeAgents] : rosterPlayers, // Include all player objects for lookup
            benchCapacity,
            benchCount,
            benchEmpty,
            outByeEmptyCount: availSummary.notPlayingCount,
            quesCount: availSummary.quesCount,
            autoSubRecommendations,
            autoSubConfig,
            // Head-to-head matchup data
            opponent,
            projectedWin,
            pointDifferential,
            winProbability,
            irList, // Include IR list for tracking moves from IR
          });
          
          // Update progress counter
          setLoadedLeagues(count => count + 1);
        } catch (err) {
          console.warn("League failed", lg?.name, {
            error: err,
            message: err instanceof Error ? err.message : 'Unknown error',
            stack: err instanceof Error ? err.stack : undefined,
            leagueId: lg?.league_id,
            name: lg?.name
          });
          // Track failed leagues for user feedback
          if (lg?.name) {
            console.error(`❌ League "${lg.name}" failed processing and was dropped from results`);
          }
          
          // Still increment counter even on error
          setLoadedLeagues(count => count + 1);
        }
      }

      setSummaries(out);
      
      // Store in React Query cache for sharing with matchups page
      queryClient.setQueryData(['league-analysis', username.trim(), season, week, considerWaivers], {
        summaries: out,
        leagues: filteredLeagues,
        timestamp: Date.now()
      });
      
      // Update URL to include username for preservation across navigation
      setLocation(`/${username.trim()}`);
      
      const failedCount = filteredLeagues.length - out.length;
      if (failedCount > 0) {
        console.warn(`⚠️  ${failedCount} leagues failed processing and were dropped from results`);
        toast({ 
          title: "Partial Success", 
          description: `Analyzed ${out.length} leagues successfully. ${failedCount} leagues failed processing (check console for details).`,
          variant: "default"
        });
      } else {
        toast({ title: "Success", description: `Analyzed ${out.length} leagues successfully` });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to analyze lineups", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExportAll = () => {
    if (sortedSummaries.length === 0) {
      toast({ title: "Error", description: "No data to export", variant: "destructive" });
      return;
    }

    const csvData = [
      ['League', 'Manager', 'Current Total', 'Optimal Total', 'Delta', 'Changes Needed'],
      ...sortedSummaries.map(s => [
        s.name,
        s.rosterUserDisplay,
        s.currentTotal.toFixed(2),
        s.optimalTotal.toFixed(2),
        s.delta.toFixed(2),
        s.optimalSlots.filter((slot, i) => s.starters[i] !== slot.player?.player_id).length.toString()
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `statchasers_lineup_analysis_${season}_week${week}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: "Success", description: "Analysis exported successfully" });
  };

  const totalPotentialPoints = sortedSummaries.reduce((sum, s) => sum + Math.max(0, s.delta), 0);
  const totalOutByeEmpty = sortedSummaries.reduce((count, s) => 
    count + (s.outByeEmptyCount || 0), 0
  );
  const totalQues = sortedSummaries.reduce((count, s) => 
    count + (s.quesCount || 0), 0
  );

  // Calculate projected record based on head-to-head matchups
  const projectedRecord = sortedSummaries.reduce((record, s) => {
    if (s.projectedWin === true) {
      record.wins++;
    } else if (s.projectedWin === false) {
      record.losses++;
    } else if (s.projectedWin === undefined && s.opponent) {
      // Handle ties (same projected points) 
      if (s.pointDifferential === 0) {
        record.ties++;
      } else {
        record.noMatchup++;
      }
    } else {
      // No opponent data available
      record.noMatchup++;
    }
    return record;
  }, { wins: 0, losses: 0, ties: 0, noMatchup: 0 });

  // Track stat trends for delta calculations
  const trends = useStatTrends(username, season, week, {
    leagues: summaries.length,
    potential: totalPotentialPoints,
    outByeEmpty: totalOutByeEmpty,
    ques: totalQues,
    wins: projectedRecord.wins,
  });

  return (
    <div className="bg-background text-foreground min-h-screen">
      {/* Header */}
      <header className="bg-card border-b-2 border-border shadow-lg relative overflow-hidden">
        {/* Gold accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gold-gradient"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex flex-col gap-2">
              <div className="text-xs text-muted-foreground">Last Update: 11/14/2025 9:42am EST</div>
              <BrandLogo className="animate-iconBounce" />
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3">
              <DarkModeToggle />
              <button 
                className="bg-navy-gradient text-white px-3 sm:px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
                onClick={() => setShowAdminModal(true)}
                data-testid="button-admin"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Admin</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Sticky Summary Bar */}
      {summaries.length > 0 && (
        <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border shadow-md">
          <TooltipProvider>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
              <div className="flex items-center justify-between gap-4 overflow-x-auto scrollbar-hide">
                <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm whitespace-nowrap">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 cursor-help">
                        <span className="text-muted-foreground">Leagues:</span>
                        <span className="font-bold text-primary">{summaries.length}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Total number of leagues analyzed for this week</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 cursor-help">
                        <span className="text-muted-foreground">Record:</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          {projectedRecord.wins + projectedRecord.losses + projectedRecord.ties > 0 
                            ? `${projectedRecord.wins}-${projectedRecord.losses}${projectedRecord.ties > 0 ? `-${projectedRecord.ties}` : ''}` 
                            : '--'}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Your projected win-loss record across all leagues this week, assuming optimal lineups</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 cursor-help">
                        <span className="text-muted-foreground">Potential:</span>
                        <span className="font-bold text-accent">+{totalPotentialPoints.toFixed(1)}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Total points you could gain by setting optimal lineups across all leagues</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 cursor-help">
                        <span className="text-muted-foreground">Alerts:</span>
                        <span className="font-bold text-red-600 dark:text-red-400">{totalOutByeEmpty}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Total starters who won't play (OUT, BYE, or empty slots)</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                
                {/* Share Summary Button */}
                <ShareSummaryCard
                  username={username}
                  week={week}
                  season={season}
                  leaguesCount={summaries.length}
                  projectedRecord={projectedRecord}
                  totalPotential={totalPotentialPoints}
                  totalAlerts={totalOutByeEmpty}
                />
              </div>
            </div>
          </TooltipProvider>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* SECTION: Setup */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4 border-gold-accent pl-3">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">Setup</h2>
          </div>
          <div className="card rounded-lg border-2 border-primary/20 shadow-lg hover:shadow-xl transition-shadow duration-300 p-6 bg-gradient-to-br from-primary/5 via-card to-accent/5">
            <h3 className="text-base sm:text-lg font-semibold mb-5 flex items-center text-foreground">
              <Users className="w-5 h-5 mr-2 text-primary" />
              Sleeper Account
            </h3>
          
          <div className="space-y-4">
            {/* Username Input */}
            <div>
              <label className="block text-sm font-medium mb-2">Sleeper Username</label>
              <input 
                type="text" 
                placeholder="Enter your Sleeper username..." 
                className="w-full px-4 py-2.5 border-2 border-input bg-background text-foreground placeholder:text-muted-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                data-testid="input-username"
              />
            </div>

            {/* Action Buttons Row */}
            <div className="space-y-3">
              {/* Season/Week inputs on mobile, inline on desktop */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <label className="text-muted-foreground whitespace-nowrap">Season:</label>
                  <input
                    className="border-2 border-input bg-background text-foreground rounded px-2.5 py-1.5 w-16 text-center focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    value={season}
                    onChange={(e) => setSeason(e.target.value)}
                    data-testid="input-season"
                  />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <label className="text-muted-foreground whitespace-nowrap">Week:</label>
                  <input
                    className="border-2 border-input bg-background text-foreground rounded px-2.5 py-1.5 w-12 text-center focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    value={week}
                    onChange={(e) => setWeek(e.target.value)}
                    data-testid="input-week"
                  />
                </div>
              </div>

              {/* Buttons - full width on mobile, inline on desktop */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  className="w-full sm:w-auto bg-primary text-primary-foreground px-8 py-3 sm:py-2.5 rounded-lg sm:rounded-md font-semibold sm:font-medium hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl text-base sm:text-sm"
                  onClick={handleAnalyzeLineups}
                  disabled={isAnalyzing || !username.trim()}
                  data-testid="button-analyze"
                >
                  {isAnalyzing ? (
                    <Loader2 className="w-5 h-5 sm:w-4 sm:h-4 animate-spin" />
                  ) : (
                    <Search className="w-5 h-5 sm:w-4 sm:h-4" />
                  )}
                  <span>{isAnalyzing ? "Analyzing..." : "Analyze Lineups"}</span>
                </button>

                {username.trim() && !isAnalyzing && (
                  <button
                    className="w-full sm:w-auto bg-secondary text-secondary-foreground px-6 py-3 sm:py-2.5 rounded-lg sm:rounded-md font-semibold sm:font-medium hover:bg-secondary/90 transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg text-base sm:text-sm"
                    onClick={() => setLocation(`/${username.trim()}/matchups`)}
                    data-testid="button-table-view"
                    title="View Table Summary"
                  >
                    <TableIcon className="w-5 h-5 sm:w-4 sm:h-4" />
                    <span>Table View</span>
                  </button>
                )}
              </div>
            </div>

            {/* Loading Progress Message */}
            {isAnalyzing && (
              <div className="bg-primary/10 border-l-4 border-primary rounded-md p-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-foreground">Fetching Sleeper data...</p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      {totalLeagues > 0 
                        ? `Processing league ${loadedLeagues} of ${totalLeagues}` 
                        : "Loading your leagues and rosters"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Options with Tooltips */}
            <div className="border-t border-border pt-4">
              <TooltipProvider>
                <div className="flex flex-wrap items-center gap-4">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <label className={`flex items-center gap-2 text-sm cursor-pointer ${!username.trim() ? 'opacity-50' : ''}`} data-testid="checkbox-waivers">
                        <input
                          type="checkbox"
                          checked={considerWaivers}
                          onChange={(e) => setConsiderWaivers(e.target.checked)}
                          disabled={!username.trim()}
                          className="rounded border-input disabled:cursor-not-allowed"
                        />
                        <span>Consider Free Agents</span>
                        <Info className="w-3.5 h-3.5 text-muted-foreground" />
                      </label>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Include available free agents in optimal lineup calculations and waiver suggestions</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <label className={`flex items-center gap-2 text-sm cursor-pointer ${!username.trim() ? 'opacity-50' : ''}`} data-testid="checkbox-opp-optimal">
                        <input
                          type="checkbox"
                          checked={oppOptimal}
                          onChange={(e) => setOppOptimal(e.target.checked)}
                          disabled={!username.trim()}
                          className="rounded border-input disabled:cursor-not-allowed"
                        />
                        <span>Show Opponent's Optimal</span>
                        <Info className="w-3.5 h-3.5 text-muted-foreground" />
                      </label>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Compare against opponent's optimal lineup instead of their current lineup</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <label className={`flex items-center gap-2 text-sm cursor-pointer ${!username.trim() ? 'opacity-50' : ''}`} data-testid="checkbox-dynasty">
                        <input
                          type="checkbox"
                          checked={filterDynasty}
                          onChange={(e) => setFilterDynasty(e.target.checked)}
                          disabled={!username.trim()}
                          className="rounded border-input disabled:cursor-not-allowed"
                        />
                        <span>Redraft Only</span>
                        <Info className="w-3.5 h-3.5 text-muted-foreground" />
                      </label>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Exclude dynasty and keeper leagues from analysis</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <label className={`flex items-center gap-2 text-sm ${!username.trim() ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} data-testid="checkbox-non-optimal">
                    <input
                      type="checkbox"
                      checked={filterNonOptimal}
                      onChange={(e) => setFilterNonOptimal(e.target.checked)}
                      disabled={!username.trim()}
                      className="rounded border-input disabled:cursor-not-allowed"
                    />
                    <span>Show only Non-Optimal Leagues</span>
                  </label>
                </div>
              </TooltipProvider>
            </div>
          </div>
          
          <div className="mt-3 text-xs" data-testid="text-projections-status">
            {usingSavedMsg ? (
              <div className="text-emerald-700">{usingSavedMsg}</div>
            ) : projections.length > 0 ? (
              <div className="text-muted-foreground">Using StatChasers projections for Week {week}. {projections.length} players available.</div>
            ) : (
              <div className="text-gray-500">No built-in projections found for this week. You can upload a CSV via the settings button.</div>
            )}
          </div>
          </div>
        </div>

        {/* SECTION: Summary */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-6 w-1 bg-primary rounded-full"></div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">Summary</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3 sm:gap-4">
            <StatSummaryCard
              id="leagues"
              label="Active Leagues"
              value={summaries.length}
              icon={Trophy}
              tone="blue"
              delta={trends.leagues.delta}
              trend={trends.leagues.trend}
              description={summaries.length === 1 ? "1 league analyzed" : `${summaries.length} leagues analyzed`}
            />
            <StatSummaryCard
              id="potential"
              label="Total Potential Pts"
              value={`+${totalPotentialPoints.toFixed(1)}`}
              icon={Flame}
              tone="green"
              delta={trends.potential.delta}
              trend={trends.potential.trend}
              description={`${totalPotentialPoints.toFixed(1)} pts vs optimal`}
            />
            <StatSummaryCard
              id="out-bye-empty"
              label="OUT/BYE/EMPTY"
              value={totalOutByeEmpty}
              icon={XCircle}
              tone="red"
              delta={trends.outByeEmpty.delta}
              trend={trends.outByeEmpty.trend}
              description={totalOutByeEmpty === 1 ? "1 player inactive" : `${totalOutByeEmpty} players inactive this week`}
            />
            <StatSummaryCard
              id="ques-doub"
              label="QUES/DOUB"
              value={totalQues}
              icon={HelpCircle}
              tone="yellow"
              delta={trends.ques.delta}
              trend={trends.ques.trend}
              description={totalQues === 1 ? "1 player questionable" : `${totalQues} players with injury concerns`}
            />
            <StatSummaryCard
              id="projected-record"
              label="Projected Record"
              value={
                projectedRecord.wins + projectedRecord.losses + projectedRecord.ties > 0 
                  ? `${projectedRecord.wins}-${projectedRecord.losses}${projectedRecord.ties > 0 ? `-${projectedRecord.ties}` : ''}` 
                  : '--'
              }
              icon={Target}
              tone="purple"
              delta={trends.wins.delta}
              trend={trends.wins.trend}
              description={
                projectedRecord.noMatchup > 0 
                  ? `${projectedRecord.wins} projected wins, ${projectedRecord.noMatchup} no matchup`
                  : `${projectedRecord.wins} projected wins this week`
              }
            />
          </div>
        </div>

        {/* Loading Progress Badge */}
        {isAnalyzing && totalLeagues > 0 && (
          <div className="mb-4 flex flex-col items-center gap-2">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-secondary text-secondary-foreground shadow-md" data-testid="badge-loading-progress">
              <div className="loading-spinner w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
              <span className="font-semibold">Analyzing: {loadedLeagues} / {totalLeagues}</span>
            </div>
            {/* Animated Progress Bar */}
            <div className="w-64 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-gold-gradient animate-progressFill transition-all duration-300"
                style={{ width: `${(loadedLeagues / totalLeagues) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* SECTION: League Insights */}
        {(isAnalyzing || sortedSummaries.length > 0) && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4 border-gold-accent pl-3">
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">League Insights</h2>
            </div>

            {/* Filter and Sort Controls */}
            {!isAnalyzing && sortedSummaries.length > 0 && (
              <div className="mb-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                {/* Sort Dropdown */}
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                  <select
                    className="text-sm border rounded-md px-3 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    data-testid="select-sort"
                  >
                    <option value="delta">Sort by: Biggest Improvements</option>
                    <option value="winProbability">Sort by: Win Probability</option>
                    <option value="injuries">Sort by: Most Injuries</option>
                    <option value="alphabetical">Sort by: A-Z</option>
                  </select>
                </div>

                {/* Filter Chips */}
                <div className="flex flex-wrap items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <button
                    className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
                      filterInjuries
                        ? 'bg-red-500 text-white shadow-md'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => setFilterInjuries(!filterInjuries)}
                    data-testid="button-filter-injuries"
                  >
                    {filterInjuries && <X className="w-3 h-3 inline mr-1" />}
                    3+ Injuries
                  </button>
                  <button
                    className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
                      filterBigDelta
                        ? 'bg-green-500 text-white shadow-md'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => setFilterBigDelta(!filterBigDelta)}
                    data-testid="button-filter-big-delta"
                  >
                    {filterBigDelta && <X className="w-3 h-3 inline mr-1" />}
                    5+ Pts Improvement
                  </button>
                  {(filterInjuries || filterBigDelta) && (
                    <button
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
                      onClick={() => {
                        setFilterInjuries(false);
                        setFilterBigDelta(false);
                      }}
                      data-testid="button-clear-filters"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>
            )}

            <section className="space-y-3 md:space-y-4">
              {isAnalyzing ? (
                <>
                  <StatChasersLoader 
                    message={totalLeagues > 0 
                      ? `Analyzing ${totalLeagues} ${totalLeagues === 1 ? "league" : "leagues"}...` 
                      : "Analyzing lineups..."
                    } 
                  />
                  {totalLeagues > 0 && (
                    <div className="mt-6">
                      <p className="text-sm text-center text-muted-foreground mb-3">
                        Loaded {loadedLeagues} / {totalLeagues}
                      </p>
                      <div className="max-w-md mx-auto">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                          <motion.div
                            className="bg-gold-gradient h-2.5 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${(loadedLeagues / totalLeagues) * 100}%` }}
                            transition={{ duration: 0.3 }}
                            data-testid="progress-bar"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  <LeagueListSkeleton />
                </>
              ) : sortedSummaries.length > 0 ? (
                <>
                  {/* Global Auto-Sub Banner */}
                  {(() => {
                    const globalSettings = detectGlobalAutoSubSettings(sortedSummaries);
                    if (globalSettings.isUniform && globalSettings.enabled) {
                      return (
                        <div className="auto-subs-global-banner mb-4" data-testid="global-auto-subs-banner">
                          Auto-subs: ON • {globalSettings.allowedPerWeek}/wk cap
                          {globalSettings.requireLaterStart && <span className="text-amber-600"> • Must start at/after</span>}
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  {sortedSummaries.map((lg, index) => {
                    const isChecked = checkedLeagues.has(lg.league_id);
                    const globalSettings = detectGlobalAutoSubSettings(sortedSummaries);
                    
                    return (
                      <motion.div
                        key={lg.league_id}
                        ref={(el) => { leagueCardRefs.current[index] = el; }}
                        className="animate-fadeIn relative"
                        style={{ animationDelay: `${Math.min(index * 50, 500)}ms` }}
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.2}
                        onDragEnd={(e, info) => {
                          // Swipe left (negative offset) = check/hide
                          if (info.offset.x < -100) {
                            setCheckedLeagues(prev => new Set(Array.from(prev).concat(lg.league_id)));
                          }
                          // Swipe right (positive offset) = uncheck
                          else if (info.offset.x > 100 && isChecked) {
                            setCheckedLeagues(prev => {
                              const next = new Set(prev);
                              next.delete(lg.league_id);
                              return next;
                            });
                          }
                        }}
                        data-testid={`swipeable-card-${lg.league_id}`}
                      >
                        {/* Checked indicator overlay */}
                        {isChecked && (
                          <div className="absolute inset-0 bg-green-100 dark:bg-green-900/20 rounded-2xl border-2 border-green-500 z-10 flex items-center justify-center pointer-events-none">
                            <div className="bg-green-500 text-white rounded-full p-3 shadow-lg">
                              <Check className="w-8 h-8" />
                            </div>
                          </div>
                        )}
                        
                        {/* League Card */}
                        <div className={isChecked ? 'opacity-50' : ''}>
                          <LeagueCard lg={lg} globalAutoSubSettings={globalSettings} />
                        </div>
                      </motion.div>
                    );
                  })}
                </>
              ) : null}
            </section>
          </div>
        )}

        {/* Empty State */}
        {!isAnalyzing && sortedSummaries.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            <ChartLine className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-lg mb-2">Ready to optimize your lineups?</p>
            <p className="text-sm">
              Enter your Sleeper username and click <strong>Analyze Lineups</strong> to get started.
            </p>
          </div>
        )}

        {/* Export Section */}
        {sortedSummaries.length > 0 && (
          <div className="mt-8 card rounded-lg border border-border p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <FileSpreadsheet className="w-5 h-5 mr-2 text-primary" />
              Export Results
            </h3>
            <div className="flex flex-wrap gap-3">
              <button 
                className="bg-accent text-accent-foreground px-4 py-2 rounded-md font-medium hover:bg-accent/90 transition-colors flex items-center gap-2"
                onClick={handleExportAll}
                data-testid="button-export-all"
              >
                <Download className="w-4 h-4" />
                Download All Leagues CSV
              </button>
              <button className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md font-medium hover:bg-secondary/80 transition-colors flex items-center gap-2" data-testid="button-share">
                <Share className="w-4 h-4" />
                Share Analysis Link
              </button>
            </div>
          </div>
        )}

        {/* Floating Action Button (FAB) for Re-analyze */}
        {sortedSummaries.length > 0 && !isAnalyzing && (
          <motion.button
            className="fixed bottom-6 right-6 bg-primary text-primary-foreground rounded-full p-4 shadow-2xl hover:shadow-3xl transition-all z-50 flex items-center gap-2 group"
            onClick={handleAnalyzeLineups}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            data-testid="button-fab-reanalyze"
          >
            <RotateCcw className="w-6 h-6" />
            <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap font-medium">
              Re-analyze
            </span>
          </motion.button>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-semibold mb-3">StatChasers Lineup Checker</h3>
              <p className="text-sm text-muted-foreground">
                Optimize your fantasy lineups with StatChasers projections and Sleeper API integration.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-3">Features</h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Real-time Sleeper API integration</li>
                <li>• Optimal lineup calculations</li>
                <li>• Risk assessment & flagging</li>
                <li>• CSV export capabilities</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-3">Version Info</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Model v1.4 • Updated Oct 3, 2025
              </p>
              <p className="text-xs text-muted-foreground">
                Always using the latest projections and optimizations.
              </p>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted-foreground">
            © 2025 StatChasers Lineup Checker. Powered by Sleeper API.
          </div>
        </div>
      </footer>

      {/* Admin Modal */}
      <AdminModal 
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        currentWeek={week}
        currentSeason={season}
      />

      {/* Mobile Sticky Footer */}
      {sortedSummaries.length > 0 && (
        <MobileStickyFooter
          onReanalyze={handleAnalyzeLineups}
          onNextLeague={() => {
            if (currentLeagueIndex < sortedSummaries.length - 1) {
              const nextIndex = currentLeagueIndex + 1;
              setCurrentLeagueIndex(nextIndex);
              scrollToLeague(nextIndex);
            }
          }}
          onBackToAll={() => {
            setCurrentLeagueIndex(0);
            setShowPersistentBackBar(false);
            scrollToLeague(0);
          }}
          currentIndex={currentLeagueIndex}
          totalLeagues={sortedSummaries.length}
          isAnalyzing={isAnalyzing}
        />
      )}

      {/* Persistent Back Bar */}
      <PersistentBackBar
        onClick={() => {
          setCurrentLeagueIndex(0);
          setShowPersistentBackBar(false);
          scrollToLeague(0);
        }}
        visible={showPersistentBackBar && sortedSummaries.length > 1}
      />
    </div>
  );
}
