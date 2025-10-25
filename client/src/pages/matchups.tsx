import { useState, useMemo, useEffect, Fragment } from "react";
import { useParams, useLocation, Link } from "wouter";
import { ChevronDown, ChevronRight, AlertTriangle, FileSpreadsheet, ArrowLeft } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { getUserByName, getUserLeagues, getLeagueRosters, getLeagueUsers, getLeagueDetails, getLeagueMatchups, getPlayersIndex, getLeagueMatchupsForLocking } from "@/lib/sleeper";
import { buildProjectionIndex } from "@/lib/projections";
import { buildSlotCounts, toPlayerLite, optimizeLineup, sumProj, statusFlags } from "@/lib/optimizer";
import { isPlayerLocked, getWeekSchedule, isTeamOnBye } from "@/lib/gameLocking";
import { isBestBallLeague } from "@/lib/isBestBall";
import { isDynastyLeague } from "@/lib/isDynasty";
import { scoreByLeague } from "@/lib/scoring";
import { loadBuiltInOrSaved, findLatestWeek } from "@/lib/builtin";
import { saveProjections, loadProjections } from "@/lib/storage";
import type { Projection } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { summarizeStarters, type Starter, type AvailTag } from "@/lib/availability";
import { OptActCell } from "@/components/OptActCell";
import { StarterBadge } from "@/components/StarterBadge";
import {
  getFreeAgentsForLeague,
  scoreFreeAgents,
  pickWaiverUpgrades,
  type WaiverSuggestion,
  type StarterWithSlot,
  type Slot,
} from "@/lib/waivers";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LeagueMetrics {
  leagueId: string;
  leagueName: string;
  format: string;
  size: number;
  league: any; // Store the full league object for filtering
  
  // Computed fields (may be undefined during progressive loading)
  record?: string;
  optPoints?: number;
  actPoints?: number;
  optMinusAct?: number;
  projectedResult?: "W" | "L" | "N/A";
  margin?: number;
  notPlayingCount?: number;
  notPlayingList?: Array<{ id?: string; name?: string; tag: AvailTag; slot: string }>;
  quesCount?: number;
  quesList?: Array<{ id?: string; name?: string; slot: string }>;
  currentStarters?: any[];
  optimalStarters?: any[];
  recommendations?: Array<{ out: any; in: any; slot: string; delta: number }>;
  opponentName?: string;
  opponentPoints?: number;
  warnings?: string[];
  waiverSuggestions?: WaiverSuggestion[];
  
  // Loading state
  isComputing?: boolean;
}

const REDRAFT_KEY = "stc:filter:redraft:on";
const OPP_OPTIMAL_KEY = "stc:opponent:optimal";
const NON_OPTIMAL_KEY = "stc:filter:non-optimal:on";

export default function MatchupsPage() {
  const params = useParams<{ username: string }>();
  const username = params.username || "";
  const [, setLocation] = useLocation();
  
  const [season, setSeason] = useState("2025");
  const [week, setWeek] = useState<string>(""); // Will be auto-detected
  const [isLoading, setIsLoading] = useState(false);
  const [projections, setProjections] = useState<Projection[]>([]);
  const [leagueMetrics, setLeagueMetrics] = useState<LeagueMetrics[]>([]);
  const [expandedLeagues, setExpandedLeagues] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"league" | "record" | "optMinusAct" | "projectedResult" | "quesCount" | "notPlayingCount">("optMinusAct");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [redraftOnly, setRedraftOnly] = useState<boolean>(() => {
    const saved = localStorage.getItem(REDRAFT_KEY);
    return saved ? saved === "1" : false;
  });
  const [nonOptimalOnly, setNonOptimalOnly] = useState<boolean>(() => {
    const saved = localStorage.getItem(NON_OPTIMAL_KEY);
    return saved ? saved === "1" : false;
  });
  const [oppOptimal, setOppOptimal] = useState<boolean>(() => {
    const saved = localStorage.getItem(OPP_OPTIMAL_KEY);
    return saved ? saved === "1" : true; // Default to optimal
  });
  const [considerWaivers, setConsiderWaivers] = useState(true);
  const [totalLeagues, setTotalLeagues] = useState(0);
  const [loadedLeagues, setLoadedLeagues] = useState(0);
  const { toast } = useToast();

  // Auto-detect the latest available week on mount
  useEffect(() => {
    (async () => {
      const latestWeek = await findLatestWeek(season);
      setWeek(String(latestWeek));
      console.log(`[Matchups] Auto-detected latest week: ${latestWeek}`);
    })();
  }, [season]);

  // Persist redraft filter preference
  useEffect(() => {
    localStorage.setItem(REDRAFT_KEY, redraftOnly ? "1" : "0");
  }, [redraftOnly]);

  // Persist non-optimal filter preference
  useEffect(() => {
    localStorage.setItem(NON_OPTIMAL_KEY, nonOptimalOnly ? "1" : "0");
  }, [nonOptimalOnly]);

  // Persist opponent optimal preference
  useEffect(() => {
    localStorage.setItem(OPP_OPTIMAL_KEY, oppOptimal ? "1" : "0");
  }, [oppOptimal]);

  // Load projections on mount and when season/week changes
  useEffect(() => {
    // Don't load projections until week is auto-detected
    if (!week) return;
    
    (async () => {
      const got = await loadBuiltInOrSaved({
        season,
        week,
        loadSaved: loadProjections,
        saveSaved: saveProjections,
        setProjections,
        setProjIdx: () => {},
        setBanner: () => {}
      });
      if (!got) {
        setProjections([]);
      }
    })();
  }, [season, week]);

  const projIdx = useMemo(() => buildProjectionIndex(projections), [projections]);

  // Load leagues on mount if username is provided
  useEffect(() => {
    if (!username || projections.length === 0) {
      return;
    }

    console.log(`[Matchups] Auto-analyzing for username: ${username}, projections: ${projections.length}`);
    
    const analyze = async () => {
      // Check if we have cached data from home page
      const cacheKey = ['league-analysis', username.trim(), season, week, considerWaivers];
      const cachedData = queryClient.getQueryData(cacheKey) as any;
      
      if (cachedData?.summaries && cachedData?.timestamp) {
        const age = Date.now() - cachedData.timestamp;
        // Use cache if less than 5 minutes old
        if (age < 5 * 60 * 1000) {
          console.log('[Matchups] Using cached league data from home page');
          // We still need to transform the data for the matchups page format
          // Skip for now and just proceed with fresh analysis
          // TODO: Transform home page summaries to matchups format
        }
      }
      
      setIsLoading(true);
      setLeagueMetrics([]); // Clear previous results
      setLoadedLeagues(0); // Reset counter
      try {
      const user = await getUserByName(username.trim());
      if (!user || !user.user_id) {
        toast({ title: "Error", description: `User "${username}" not found on Sleeper`, variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const allLeagues = await getUserLeagues(user.user_id, season);
      
      // Filter out Best Ball leagues
      const leagues = allLeagues.filter((lg) => !isBestBallLeague(lg));
      const bestBallCount = allLeagues.length - leagues.length;
      if (bestBallCount > 0) {
        console.log(`[Matchups] Filtered out ${bestBallCount} Best Ball leagues`);
      }

      // Set total leagues count for progress tracking
      setTotalLeagues(leagues.length);

      // STEP 1: Render fast - show basic league info immediately
      const initialMetrics: LeagueMetrics[] = leagues.map(lg => ({
        leagueId: lg.league_id,
        leagueName: lg.name,
        format: lg.scoring_settings?.rec === 1 ? "PPR" : lg.scoring_settings?.rec === 0.5 ? "Half" : "Std",
        size: lg.total_rosters || 0,
        league: lg,
        isComputing: true, // Mark as computing
      }));
      
      setLeagueMetrics(initialMetrics);

      // STEP 2: Compute deep analysis progressively for each league
      const playersIndex = await getPlayersIndex();
      const schedule = await getWeekSchedule(season, week);

      for (const lg of leagues) {
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
                          rosters.find((r: any) => r.roster_id === lg.roster_id);
          
          if (!meRoster) continue;

          const owner = users.find((u: any) => u.user_id === meRoster.owner_id);
          const roster_positions: string[] = leagueDetails?.roster_positions || lg.roster_positions || [];
          const slotCounts = buildSlotCounts(roster_positions);
          const scoring = leagueDetails?.scoring_settings || {};

          // Use matchup starters (reflects in-week changes)
          const meMatchup = matchups?.find((m: any) => m.roster_id === meRoster.roster_id);
          const actualStarters = (meMatchup && meMatchup.starters && meMatchup.starters.length > 0) 
            ? meMatchup.starters 
            : (meRoster?.starters || []);
          
          const starters: (string | null)[] = actualStarters;
          const validStarters = starters.filter((x): x is string => !!x);
          const bench: string[] = (meRoster?.players || []).filter((p: string) => p && !validStarters.includes(p));

          // Build enriched player list
          const addWithProj = (pid: string) => {
            const lite = toPlayerLite(playersIndex, pid);
            if (!lite) return null;
            const pr = projIdx[pid] || projIdx[`${lite.name.toLowerCase()}|${lite.team ?? ""}|${lite.pos}`];
            
            let adj = 0;
            if (pr) {
              const stats = (pr as any)?.stats || {};
              adj = scoreByLeague(lite.pos, stats, scoring, pr.proj);
            }

            const flags = statusFlags({ ...lite, proj: adj, opp: pr?.opp });
            const isOut = flags.includes("OUT");
            const finalProj = isOut ? 0 : adj;
            const locked = isPlayerLocked(lite, schedule, Date.now(), playedPlayerIds);
            
            // Use actual points if available and player is locked
            const actual = actualPoints[pid];
            const displayProj = (locked && actual !== undefined) ? actual : finalProj;
            
            // Determine opponent - for defenses without projections, check if team is on BYE
            let opp = pr?.opp;
            if (!opp && lite.pos === "DEF" && lite.team) {
              opp = isTeamOnBye(lite.team, schedule) ? "BYE" : undefined;
            }
            
            return { ...lite, proj: displayProj, opp, locked, injury_status: lite.injury_status, actualPoints: actual };
          };

          const starterObjs = validStarters.map(addWithProj).filter(Boolean) as any[];
          const benchObjs = bench.map(addWithProj).filter(Boolean) as any[];
          const allEligible = [...starterObjs, ...benchObjs];

          // Calculate optimal lineup
          const optimalSlots = optimizeLineup(slotCounts, allEligible, season, week, starters);
          const optPoints = sumProj(optimalSlots);

          // Calculate actual points from current starters
          const fixedSlots = roster_positions.filter((s: string) => !["BN","IR","TAXI"].includes(s));
          const currentSlots = starters.slice(0, fixedSlots.length).map((pid, i) => {
            if (!pid) return { slot: fixedSlots[i] };
            const player = addWithProj(pid);
            if (!player) return { slot: fixedSlots[i] };
            return { slot: fixedSlots[i], player };
          });
          const actPoints = sumProj(currentSlots as any);

          // Use new availability classification system
          const startersForClassification: Starter[] = fixedSlots.map((slot: string, i: number) => {
            const pid = starters[i];
            if (!pid) return { slot, player_id: undefined };
            const player = starterObjs.find(s => s.player_id === pid) || addWithProj(pid);
            return {
              slot,
              player_id: player?.player_id,
              name: player?.name,
              pos: player?.pos,
              opp: player?.opp,
              injury_status: player?.injury_status,
              proj: player?.proj,
              locked: player?.locked
            };
          });

          const availabilitySummary = summarizeStarters(startersForClassification);
          const { notPlayingCount, notPlayingList, quesCount, quesList } = availabilitySummary;

          // Find opponent and calculate projected result
          let opponentName = "N/A";
          let opponentPoints = 0;
          let projectedResult: "W" | "L" | "N/A" = "N/A";
          let margin = 0;

          if (meMatchup && meMatchup.matchup_id) {
            const oppMatchup = matchups.find((m: any) => 
              m.matchup_id === meMatchup.matchup_id && m.roster_id !== meRoster.roster_id
            );
            
            if (oppMatchup) {
              const oppRoster = rosters.find((r: any) => r.roster_id === oppMatchup.roster_id);
              const oppUser = users.find((u: any) => u.user_id === oppRoster?.owner_id);
              opponentName = oppUser?.metadata?.team_name || oppUser?.display_name || "Unknown";

              // Calculate opponent's points (optimal or current based on toggle)
              const oppActualStarters = (oppMatchup.starters && oppMatchup.starters.length > 0) 
                ? oppMatchup.starters 
                : (oppRoster?.starters || []);
              const oppValidStarters = oppActualStarters.filter((x: any): x is string => !!x);
              const oppBench: string[] = (oppRoster?.players || []).filter((p: string) => p && !oppValidStarters.includes(p));
              const oppStarterObjs = oppValidStarters.map(addWithProj).filter(Boolean) as any[];
              const oppBenchObjs = oppBench.map(addWithProj).filter(Boolean) as any[];
              
              if (oppOptimal) {
                // Use opponent's optimal lineup
                const oppAllEligible = [...oppStarterObjs, ...oppBenchObjs];
                const oppOptimalSlots = optimizeLineup(slotCounts, oppAllEligible, season, week, oppActualStarters);
                opponentPoints = sumProj(oppOptimalSlots);
              } else {
                // Use opponent's current lineup
                const oppFixedSlots = roster_positions.filter((s: string) => !["BN","IR","TAXI"].includes(s));
                const oppCurrentSlots = oppActualStarters.slice(0, oppFixedSlots.length).map((pid: any, i: number) => {
                  if (!pid) return { slot: oppFixedSlots[i] };
                  const player = addWithProj(pid);
                  if (!player) return { slot: oppFixedSlots[i] };
                  return { slot: oppFixedSlots[i], player };
                });
                opponentPoints = sumProj(oppCurrentSlots as any);
              }

              // Compare optimal vs opponent (optimal or current)
              margin = optPoints - opponentPoints;
              projectedResult = optPoints >= opponentPoints ? "W" : "L";
            }
          }

          // Build recommendations - only show bench → starter promotions
          const recommendations: Array<{ out: any; in: any; slot: string; delta: number }> = [];
          
          // Identify which players are in current starters vs optimal starters
          const currStarterIds = new Set(validStarters);
          const optStarterIds = new Set(
            optimalSlots.map(s => s.player?.player_id).filter(Boolean)
          );
          
          // Find promotions (bench players entering starting lineup)
          const promotions = optimalSlots
            .filter(s => s.player && !currStarterIds.has(s.player.player_id))
            .map(s => ({ ...s.player, slot: s.slot }));
          
          // Find demotions (starters being benched)
          const demotions = currentSlots
            .filter(s => s.player && !optStarterIds.has(s.player.player_id))
            .map(s => ({ ...s.player, slot: s.slot }));
          
          // Pair promotions with demotions
          const demotedPool = [...demotions];
          for (const inPlayer of promotions) {
            // Find best demotion to pair with (highest gain)
            let bestIdx = -1;
            let bestGain = -Infinity;
            let bestOut: any = null;
            
            for (let i = 0; i < demotedPool.length; i++) {
              const outPlayer = demotedPool[i];
              // Make sure it's not the same player and calculate gain
              if (inPlayer.player_id !== outPlayer.player_id) {
                const gain = (inPlayer.proj ?? 0) - (outPlayer.proj ?? 0);
                if (gain > bestGain) {
                  bestGain = gain;
                  bestIdx = i;
                  bestOut = outPlayer;
                }
              }
            }
            
            if (bestOut && bestIdx >= 0) {
              recommendations.push({
                out: bestOut,
                in: inPlayer,
                slot: inPlayer.slot,
                delta: bestGain
              });
              demotedPool.splice(bestIdx, 1);
            }
          }

          // Build warnings (keeping for backward compatibility, but will show in new format in UI)
          const warnings: string[] = [];
          if (quesCount > 0) warnings.push(`${quesCount} questionable starter${quesCount > 1 ? 's' : ''}`);
          if (notPlayingCount > 0) warnings.push(`${notPlayingCount} not playing${notPlayingCount > 1 ? ' starters' : ' starter'}`);

          // Calculate waiver suggestions (only if considerWaivers is enabled)
          let waiverSuggestions: WaiverSuggestion[] = [];
          if (considerWaivers) {
            try {
              // Build set of owned player IDs across all rosters
              const ownedPlayerIds = new Set<string>();
              rosters.forEach((roster: any) => {
                (roster.players || []).forEach((pid: string) => ownedPlayerIds.add(pid));
              });

              // Fetch free agents for this league
              const freeAgents = await getFreeAgentsForLeague(
                lg.league_id,
                playersIndex,
                ownedPlayerIds
              );

              // Convert projIdx to Map for scoreFreeAgents
              const projMap = new Map(Object.entries(projIdx));

              // Score free agents with league-adjusted projections
              const scoredFAs = scoreFreeAgents(freeAgents, scoring, projMap);

              // Convert optimal starters to StarterWithSlot format
              const startersWithSlots: StarterWithSlot[] = optimalSlots
                .filter((s: any) => s.player)
                .map((s: any) => ({
                  player_id: s.player.player_id,
                  name: s.player.name,
                  pos: s.player.pos,
                  slot: s.slot,
                  proj: s.player.proj ?? 0,
                }));

              // Extract active roster slots from league's roster_positions
              // Only include slots we support (filter out IDP and other custom positions)
              const supportedSlots: Slot[] = ["QB", "RB", "WR", "TE", "K", "DEF", "FLEX", "SUPER_FLEX"];
              const activeSlots = new Set<Slot>(
                (lg.roster_positions || [])
                  .filter((pos: string) => pos !== "BN" && pos !== "IR" && supportedSlots.includes(pos as Slot))
                  .map((pos: string) => pos as Slot)
              );

              // Pick top waiver upgrades (only for slots this league actually has)
              waiverSuggestions = pickWaiverUpgrades(scoredFAs, startersWithSlots, activeSlots);
            } catch (waiverErr) {
              console.error(`[Waivers] Error calculating suggestions for league ${lg.league_id}:`, waiverErr);
            }
          }

          // Update the existing league entry with computed data
          setLeagueMetrics(prev => prev.map(metric => 
            metric.leagueId === lg.league_id
              ? {
                  ...metric,
                  record: `${meRoster.settings?.wins || 0}-${meRoster.settings?.losses || 0}${meRoster.settings?.ties ? `-${meRoster.settings.ties}` : ''}`,
                  optPoints,
                  actPoints,
                  optMinusAct: optPoints - actPoints,
                  projectedResult,
                  margin,
                  notPlayingCount,
                  notPlayingList,
                  quesCount,
                  quesList,
                  currentStarters: currentSlots,
                  optimalStarters: optimalSlots,
                  recommendations,
                  opponentName,
                  opponentPoints,
                  warnings,
                  waiverSuggestions,
                  isComputing: false, // Done computing
                }
              : metric
          ));
          
          // Update progress counter
          setLoadedLeagues(count => count + 1);

        } catch (err) {
          console.error(`[Matchups] Error processing league ${lg.league_id}:`, err);
          // Mark league as done computing even on error
          setLeagueMetrics(prev => prev.map(metric => 
            metric.leagueId === lg.league_id
              ? { ...metric, isComputing: false }
              : metric
          ));
          // Still increment counter even on error
          setLoadedLeagues(count => count + 1);
        }
      }

      setIsLoading(false);
    } catch (err) {
      console.error("[Matchups] Error:", err);
      toast({ title: "Error", description: "Failed to analyze leagues", variant: "destructive" });
      setIsLoading(false);
    }
    };
    
    analyze();
  }, [username, projections, season, week, projIdx, toast, considerWaivers, oppOptimal]);

  const sortedMetrics = useMemo(() => {
    // Apply filters
    let filtered = leagueMetrics;
    
    // Redraft filter - show only non-dynasty leagues
    if (redraftOnly) {
      filtered = filtered.filter((metric) => !isDynastyLeague(metric.league));
    }
    
    // Non-optimal filter - show only leagues where improvements can be made
    if (nonOptimalOnly) {
      filtered = filtered.filter((metric) => (metric.optMinusAct ?? 0) > 0.01);
    }
    
    const sorted = [...filtered].sort((a, b) => {
      let aVal, bVal;
      switch (sortBy) {
        case "league":
          // Alphabetical sorting by league name
          return sortOrder === "desc" 
            ? b.leagueName.localeCompare(a.leagueName)
            : a.leagueName.localeCompare(b.leagueName);
        case "record":
          // Sort by win percentage, then by total games
          const parseRecord = (record?: string) => {
            if (!record) return { winPct: -1, games: 0 };
            const [wins, losses] = record.split("-").map(Number);
            const totalGames = wins + losses;
            const winPct = totalGames > 0 ? wins / totalGames : 0;
            return { winPct, games: totalGames };
          };
          const aRecord = parseRecord(a.record);
          const bRecord = parseRecord(b.record);
          if (aRecord.winPct !== bRecord.winPct) {
            aVal = aRecord.winPct;
            bVal = bRecord.winPct;
          } else {
            aVal = aRecord.games;
            bVal = bRecord.games;
          }
          break;
        case "optMinusAct":
          aVal = a.optMinusAct ?? -Infinity;
          bVal = b.optMinusAct ?? -Infinity;
          break;
        case "projectedResult":
          aVal = a.projectedResult === "W" ? 1 : a.projectedResult === "L" ? 0 : -1;
          bVal = b.projectedResult === "W" ? 1 : b.projectedResult === "L" ? 0 : -1;
          break;
        case "quesCount":
          aVal = a.quesCount ?? -Infinity;
          bVal = b.quesCount ?? -Infinity;
          break;
        case "notPlayingCount":
          aVal = a.notPlayingCount ?? -Infinity;
          bVal = b.notPlayingCount ?? -Infinity;
          break;
        default:
          aVal = a.optMinusAct ?? -Infinity;
          bVal = b.optMinusAct ?? -Infinity;
      }
      return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
    });
    return sorted;
  }, [leagueMetrics, sortBy, sortOrder, redraftOnly, nonOptimalOnly]);

  const toggleExpanded = (leagueId: string) => {
    const newSet = new Set(expandedLeagues);
    if (newSet.has(leagueId)) {
      newSet.delete(leagueId);
    } else {
      newSet.add(leagueId);
    }
    setExpandedLeagues(newSet);
  };

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="default"
              onClick={() => setLocation(username ? `/${username}` : "/")}
              className="h-11"
              data-testid="button-back-home"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </div>
          
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-page-title">StatChasers Lineup Checker</h1>
              <p className="text-muted-foreground mt-1 text-sm sm:text-base" data-testid="text-username">
                Analyzing leagues for <span className="font-semibold">{username}</span>
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2">
                <Select value={season} onValueChange={setSeason}>
                  <SelectTrigger className="w-28 sm:w-32" data-testid="select-season">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2024">2024</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={week} onValueChange={setWeek}>
                  <SelectTrigger className="w-28 sm:w-32" data-testid="select-week">
                    <SelectValue placeholder="Week" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
                      <SelectItem key={w} value={String(w)}>Week {w}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="consider-waivers" className="flex items-center gap-2 py-3 cursor-pointer min-h-[44px]" data-testid="label-waivers">
                  <Switch 
                    id="consider-waivers" 
                    checked={considerWaivers} 
                    onCheckedChange={setConsiderWaivers}
                    className="data-[state=checked]:bg-primary"
                    data-testid="switch-waivers"
                  />
                  <span className="text-xs sm:text-sm">Free Agents</span>
                </label>
                
                <label htmlFor="opp-optimal" className="flex items-center gap-2 py-3 cursor-pointer min-h-[44px]" data-testid="label-opp-optimal">
                  <Switch 
                    id="opp-optimal" 
                    checked={oppOptimal} 
                    onCheckedChange={setOppOptimal}
                    className="data-[state=checked]:bg-primary"
                    data-testid="switch-opp-optimal"
                  />
                  <span className="text-xs sm:text-sm">Show Opponent's Optimal</span>
                </label>
                
                <label htmlFor="redraft-only" className="flex items-center gap-2 py-3 cursor-pointer min-h-[44px]" data-testid="label-redraft-filter">
                  <Switch 
                    id="redraft-only" 
                    checked={redraftOnly} 
                    onCheckedChange={setRedraftOnly}
                    className="data-[state=checked]:bg-primary"
                    data-testid="switch-redraft-filter"
                  />
                  <span className="text-xs sm:text-sm">Redraft Only</span>
                </label>
                
                <label htmlFor="non-optimal-only" className="flex items-center gap-2 py-3 cursor-pointer min-h-[44px]" data-testid="label-non-optimal-filter">
                  <Switch 
                    id="non-optimal-only" 
                    checked={nonOptimalOnly} 
                    onCheckedChange={setNonOptimalOnly}
                    className="data-[state=checked]:bg-primary"
                    data-testid="switch-non-optimal-filter"
                  />
                  <span className="text-xs sm:text-sm">Show only Non-Optimal Leagues</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {projections.length > 0 && (
              <Badge variant="outline" className="w-fit" data-testid="badge-projections">
                Using StatChasers projections for Week {week}
              </Badge>
            )}
            {isLoading && totalLeagues > 0 && (
              <Badge variant="secondary" className="w-fit animate-pulse" data-testid="badge-loading-progress">
                Analyzing: {loadedLeagues} / {totalLeagues}
              </Badge>
            )}
            {(redraftOnly || nonOptimalOnly) && leagueMetrics.length > 0 && (
              <Badge variant="secondary" className="w-fit" data-testid="badge-filters-active">
                {redraftOnly && nonOptimalOnly && `Redraft + Non-optimal: ${sortedMetrics.length} of ${leagueMetrics.length}`}
                {redraftOnly && !nonOptimalOnly && `Redraft only: ${sortedMetrics.length} of ${leagueMetrics.length}`}
                {!redraftOnly && nonOptimalOnly && `Non-optimal only: ${sortedMetrics.length} of ${leagueMetrics.length}`}
              </Badge>
            )}
            {!redraftOnly && !nonOptimalOnly && leagueMetrics.length > 0 && !isLoading && (
              <span className="text-xs text-muted-foreground" data-testid="text-league-count">
                {sortedMetrics.length} {sortedMetrics.length === 1 ? 'league' : 'leagues'}
              </span>
            )}
          </div>
        </div>

        {/* Leagues Table */}
        {isLoading && leagueMetrics.length === 0 ? (
          <div className="space-y-4">
            {totalLeagues > 0 && (
              <div className="text-center" data-testid="text-loading-progress">
                <p className="text-muted-foreground">
                  Analyzing leagues: {loadedLeagues} / {totalLeagues}
                </p>
              </div>
            )}
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>League</TableHead>
                    <TableHead className="text-center">Record</TableHead>
                    <TableHead className="text-center">Opt-Act</TableHead>
                    <TableHead className="text-center">Proj Result</TableHead>
                    <TableHead className="text-center">QUES?</TableHead>
                    <TableHead className="text-center">OUT/BYE/EMPTY?</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: Math.min(totalLeagues || 5, 5) }).map((_, i) => (
                    <TableRow key={i} className="animate-pulse">
                      <TableCell>
                        <div className="h-4 w-4 bg-muted rounded" />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="h-4 bg-muted rounded w-48" />
                          <div className="flex gap-2">
                            <div className="h-5 bg-muted rounded w-12" />
                            <div className="h-5 bg-muted rounded w-16" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="h-4 bg-muted rounded w-12 mx-auto" />
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="h-4 bg-muted rounded w-16 mx-auto" />
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="h-6 bg-muted rounded w-8 mx-auto" />
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="h-4 bg-muted rounded w-8 mx-auto" />
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="h-4 bg-muted rounded w-8 mx-auto" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : leagueMetrics.length === 0 ? (
          <div className="text-center py-12" data-testid="text-no-leagues">
            <p className="text-muted-foreground">No leagues found. Make sure you have projections loaded.</p>
          </div>
        ) : (
          <>
          {/* Mobile Card View - HIDDEN, using table on all screen sizes */}
          <div className="hidden space-y-3">
            {sortedMetrics.map((league) => (
              <div
                key={league.leagueId}
                className={`border rounded-lg ${
                  league.projectedResult === "W" 
                    ? "border-l-4 border-l-green-500" 
                    : league.projectedResult === "L"
                    ? "border-l-4 border-l-red-500"
                    : ""
                }`}
                data-testid={`card-league-${league.leagueId}`}
              >
                <button
                  className="w-full p-4 text-left"
                  onClick={() => toggleExpanded(league.leagueId)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-sm break-words" data-testid={`text-league-name-${league.leagueId}`}>
                          {league.leagueName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <Badge variant="secondary" className="text-xs" data-testid={`badge-format-${league.leagueId}`}>
                          {league.format}
                        </Badge>
                        <Badge variant="outline" className="text-xs" data-testid={`badge-size-${league.leagueId}`}>
                          {league.size} teams
                        </Badge>
                        {league.record && (
                          <span className="text-muted-foreground">{league.record}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {league.projectedResult && league.projectedResult !== "N/A" && (
                        <Badge
                          variant={league.projectedResult === "W" ? "default" : league.projectedResult === "L" ? "destructive" : "outline"}
                          data-testid={`badge-result-${league.leagueId}`}
                        >
                          {league.projectedResult}
                        </Badge>
                      )}
                      {expandedLeagues.has(league.leagueId) ? (
                        <ChevronDown className="h-5 w-5 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-5 w-5 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Opt-Act</div>
                      {league.isComputing || league.optPoints === undefined ? (
                        <div className="h-4 bg-muted rounded w-16 animate-pulse" />
                      ) : (
                        <OptActCell optPoints={league.optPoints} actPoints={league.actPoints ?? 0} />
                      )}
                    </div>
                    {league.projectedResult !== "N/A" && league.margin !== undefined && (
                      <div>
                        <div className="text-xs text-muted-foreground">Margin</div>
                        <div className="font-medium">
                          {league.margin > 0 ? "+" : ""}{league.margin.toFixed(1)}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {((league.notPlayingCount && league.notPlayingCount > 0) || (league.quesCount && league.quesCount > 0)) && (
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {league.notPlayingCount && league.notPlayingCount > 0 && (
                        <span className="rounded-full bg-red-50 text-red-700 border border-red-200 text-xs px-2 py-0.5 font-medium" data-testid={`badge-not-playing-${league.leagueId}`}>
                          OUT/BYE/EMPTY: {league.notPlayingCount}
                        </span>
                      )}
                      {league.quesCount && league.quesCount > 0 && (
                        <span className="rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200 text-xs px-2 py-0.5 font-medium dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700" data-testid={`badge-ques-${league.leagueId}`}>
                          QUES: {league.quesCount}
                        </span>
                      )}
                    </div>
                  )}
                </button>
                
                {/* Expanded Content for Mobile */}
                {expandedLeagues.has(league.leagueId) && (
                  <div className="border-t bg-muted/50 p-4" data-testid={`expanded-${league.leagueId}`}>
                    {league.isComputing ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Analyzing league...</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Not playing list */}
                        {league.notPlayingCount !== undefined && league.notPlayingCount > 0 && league.notPlayingList && (
                          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-800 text-sm" data-testid={`not-playing-warning-${league.leagueId}`}>
                            <div className="font-medium">OUT/BYE/EMPTY starters</div>
                            <div className="text-xs mt-1">
                              {(league.notPlayingList ?? []).map((p, i) => (
                                <span key={p.id || i}>
                                  {p.name || "—"}{p.tag ? ` (${p.tag})` : ""}{i < (league.notPlayingList ?? []).length - 1 ? ", " : ""}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Questionable list */}
                        {league.quesCount !== undefined && league.quesCount > 0 && league.quesList && (
                          <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700 text-sm" data-testid={`ques-warning-${league.leagueId}`}>
                            <div className="font-medium">Questionable starters</div>
                            <div className="text-xs mt-1">
                              {(league.quesList ?? []).map((p, i) => (
                                <span key={p.id || i}>
                                  {p.name}{i < (league.quesList ?? []).length - 1 ? ", " : ""}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Opponent Info */}
                        {league.opponentName && league.opponentPoints !== undefined && (
                          <div className="p-3 bg-background rounded-lg border text-sm" data-testid={`opponent-card-${league.leagueId}`}>
                            <div className="font-semibold">Opponent: {league.opponentName}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Projected: {league.opponentPoints.toFixed(1)} pts
                            </div>
                          </div>
                        )}

                        {/* Recommendations */}
                        {league.recommendations && league.recommendations.length > 0 && (
                          <div className="space-y-2" data-testid={`recommendations-${league.leagueId}`}>
                            <h4 className="text-sm font-semibold">Recommended Changes:</h4>
                            <div className="space-y-2">
                              {league.recommendations.map((rec, idx) => (
                                <div
                                  key={idx}
                                  className="flex flex-col gap-1 p-2 bg-background rounded-lg border text-xs"
                                  data-testid={`recommendation-${league.leagueId}-${idx}`}
                                >
                                  {rec.out && (
                                    <div className="text-red-600 flex items-center">
                                      <span>Out: {rec.out.name} ({rec.out.proj.toFixed(1)})</span>
                                      <StarterBadge p={rec.out} />
                                    </div>
                                  )}
                                  <div className="text-green-600 flex items-center">
                                    <span>In: {rec.in.name} ({rec.in.proj.toFixed(1)})</span>
                                    <StarterBadge p={rec.in} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {league.recommendations && league.recommendations.length === 0 && (
                          <div className="text-center text-muted-foreground py-4 text-sm" data-testid={`no-changes-${league.leagueId}`}>
                            Your lineup is already optimal!
                          </div>
                        )}

                        {/* Waiver Watchlist */}
                        {league.waiverSuggestions && league.waiverSuggestions.length > 0 && (
                          <div className="rounded-lg border p-3 bg-background" data-testid={`waiver-watchlist-${league.leagueId}`}>
                            <h4 className="font-semibold text-sm mb-2">Waiver Watchlist</h4>
                            <ul className="space-y-2">
                              {league.waiverSuggestions.map((s, idx) => (
                                <li
                                  key={`${s.slot}-${s.inP.player_id}-${idx}`}
                                  className="rounded-md border p-2 text-xs"
                                  data-testid={`waiver-suggestion-${league.leagueId}-${idx}`}
                                >
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-green-700 font-medium">
                                      Add {s.inP.name}
                                    </span>
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                                      +{s.delta.toFixed(1)} pts
                                    </Badge>
                                  </div>
                                  <div className="text-muted-foreground mt-1">
                                    over {s.outP.name} ({s.outP.pos}, {s.outP.proj.toFixed(1)} pts)
                                  </div>
                                  <a
                                    className="text-primary hover:underline text-xs mt-1 inline-block"
                                    href={`https://sleeper.com/leagues/${league.leagueId}/players/${s.inP.player_id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    View on Sleeper →
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {/* Table View - shown on all screen sizes */}
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8 sm:w-12"></TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-accent min-w-[180px]"
                    onClick={() => handleSort("league")}
                    data-testid="header-league"
                  >
                    League {sortBy === "league" && (sortOrder === "desc" ? "↓" : "↑")}
                  </TableHead>
                  <TableHead 
                    className="text-center cursor-pointer hover:bg-accent min-w-[80px]"
                    onClick={() => handleSort("record")}
                    data-testid="header-record"
                  >
                    Record {sortBy === "record" && (sortOrder === "desc" ? "↓" : "↑")}
                  </TableHead>
                  <TableHead 
                    className="text-center cursor-pointer hover:bg-accent"
                    onClick={() => handleSort("optMinusAct")}
                    data-testid="header-opt-act"
                  >
                    <Tooltip>
                      <TooltipTrigger className="w-full">
                        Opt-Act {sortBy === "optMinusAct" && (sortOrder === "desc" ? "↓" : "↑")}
                      </TooltipTrigger>
                      <TooltipContent>
                        Projected points if you set the optimal lineup minus your current starters
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead 
                    className="text-center cursor-pointer hover:bg-accent"
                    onClick={() => handleSort("projectedResult")}
                    data-testid="header-projected-result"
                  >
                    <Tooltip>
                      <TooltipTrigger className="w-full">
                        Proj Result {sortBy === "projectedResult" && (sortOrder === "desc" ? "↓" : "↑")}
                      </TooltipTrigger>
                      <TooltipContent>
                        W/L based on your total vs your opponent's total (optimal lineups)
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead 
                    className="text-center cursor-pointer hover:bg-accent"
                    onClick={() => handleSort("quesCount")}
                    data-testid="header-ques"
                  >
                    <Tooltip>
                      <TooltipTrigger className="w-full">
                        QUES? {sortBy === "quesCount" && (sortOrder === "desc" ? "↓" : "↑")}
                      </TooltipTrigger>
                      <TooltipContent>
                        Number of starters listed as Questionable/Doubtful/Suspended
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead 
                    className="text-center cursor-pointer hover:bg-accent"
                    onClick={() => handleSort("notPlayingCount")}
                    data-testid="header-not-playing"
                  >
                    <Tooltip>
                      <TooltipTrigger className="w-full">
                        OUT/BYE/EMPTY? {sortBy === "notPlayingCount" && (sortOrder === "desc" ? "↓" : "↑")}
                      </TooltipTrigger>
                      <TooltipContent>
                        Players who will score 0 unless changed (Out, Bye, or Empty slot)
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMetrics.map((league) => (
                  <Fragment key={league.leagueId}>
                    <TableRow
                      className={`cursor-pointer ${
                        league.projectedResult === "W" 
                          ? "border-l-4 border-l-green-500" 
                          : league.projectedResult === "L"
                          ? "border-l-4 border-l-red-500"
                          : ""
                      }`}
                      onClick={() => toggleExpanded(league.leagueId)}
                      data-testid={`row-league-${league.leagueId}`}
                    >
                      <TableCell>
                        {expandedLeagues.has(league.leagueId) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium" data-testid={`text-league-name-${league.leagueId}`}>
                              {league.leagueName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs" data-testid={`badge-format-${league.leagueId}`}>
                              {league.format}
                            </Badge>
                            <Badge variant="outline" className="text-xs" data-testid={`badge-size-${league.leagueId}`}>
                              {league.size} teams
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center" data-testid={`text-record-${league.leagueId}`}>
                        {league.isComputing || !league.record ? (
                          <div className="h-4 bg-muted rounded w-12 mx-auto animate-pulse" />
                        ) : (
                          league.record
                        )}
                      </TableCell>
                      <TableCell className="text-center" data-testid={`text-opt-act-${league.leagueId}`}>
                        {league.isComputing || league.optPoints === undefined ? (
                          <div className="h-4 bg-muted rounded w-16 mx-auto animate-pulse" />
                        ) : (
                          <OptActCell optPoints={league.optPoints} actPoints={league.actPoints ?? 0} />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {league.isComputing || !league.projectedResult ? (
                          <div className="h-6 bg-muted rounded w-8 mx-auto animate-pulse" />
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <Badge
                              variant={league.projectedResult === "W" ? "default" : league.projectedResult === "L" ? "destructive" : "outline"}
                              data-testid={`badge-result-${league.leagueId}`}
                            >
                              {league.projectedResult}
                            </Badge>
                            {league.projectedResult !== "N/A" && league.margin !== undefined && (
                              <span className="text-xs text-muted-foreground" data-testid={`text-margin-${league.leagueId}`}>
                                {league.margin > 0 ? "+" : ""}{league.margin.toFixed(1)}
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {league.isComputing || league.quesCount === undefined ? (
                          <div className="h-4 bg-muted rounded w-8 mx-auto animate-pulse" />
                        ) : league.quesCount > 0 ? (
                          <span className="rounded-full bg-yellow-50 text-yellow-700 text-xs px-2 py-0.5 dark:bg-yellow-900/30 dark:text-yellow-300" data-testid={`badge-ques-${league.leagueId}`}>
                            {league.quesCount}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {league.isComputing || league.notPlayingCount === undefined ? (
                          <div className="h-4 bg-muted rounded w-8 mx-auto animate-pulse" />
                        ) : league.notPlayingCount > 0 ? (
                          <span className="rounded-full bg-red-50 text-red-700 text-xs px-2 py-0.5" data-testid={`badge-not-playing-${league.leagueId}`}>
                            {league.notPlayingCount}
                          </span>
                        ) : (
                          <span className="rounded-full bg-green-50 text-green-600 text-xs px-2 py-0.5">0</span>
                        )}
                      </TableCell>
                    </TableRow>
                    
                    {/* Expanded Row Content */}
                    {expandedLeagues.has(league.leagueId) && (
                      <TableRow data-testid={`expanded-${league.leagueId}`}>
                        <TableCell colSpan={7} className="bg-muted/50 p-3 sm:p-6">
                          {league.isComputing ? (
                            <div className="text-center py-8">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
                              <p className="text-sm text-muted-foreground">Analyzing league...</p>
                            </div>
                          ) : (
                            <div className="space-y-6">
                              {/* Not playing list */}
                              {league.notPlayingCount !== undefined && league.notPlayingCount > 0 && league.notPlayingList && (
                                <div className="my-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-800" data-testid={`not-playing-warning-${league.leagueId}`}>
                                  <div className="font-medium">OUT/BYE/EMPTY starters</div>
                                  <div className="text-sm">
                                    {(league.notPlayingList ?? []).map((p, i) => (
                                      <span key={p.id || i}>
                                        {p.name || "—"}{p.tag ? ` (${p.tag})` : ""}{i < (league.notPlayingList ?? []).length - 1 ? ", " : ""}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Questionable list */}
                              {league.quesCount !== undefined && league.quesCount > 0 && league.quesList && (
                                <div className="my-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700" data-testid={`ques-warning-${league.leagueId}`}>
                                  <div className="font-medium">Questionable starters</div>
                                  <div className="text-sm">
                                    {(league.quesList ?? []).map((p, i) => (
                                      <span key={p.id || i}>
                                        {p.name}{i < (league.quesList ?? []).length - 1 ? ", " : ""}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Opponent Info */}
                              {league.opponentName && league.opponentPoints !== undefined && (
                                <div className="p-4 bg-background rounded-lg border" data-testid={`opponent-card-${league.leagueId}`}>
                                  <h4 className="font-semibold mb-2">Opponent: {league.opponentName}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    Projected Points: {league.opponentPoints.toFixed(1)}
                                  </p>
                                </div>
                              )}

                              {/* Recommendations */}
                              {league.recommendations && league.recommendations.length > 0 && (
                              <div className="space-y-2" data-testid={`recommendations-${league.leagueId}`}>
                                <h4 className="text-sm sm:text-base font-semibold">Recommended Changes:</h4>
                                <div className="space-y-2">
                                  {league.recommendations.map((rec, idx) => (
                                    <div
                                      key={idx}
                                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 bg-background rounded-lg border"
                                      data-testid={`recommendation-${league.leagueId}-${idx}`}
                                    >
                                      {rec.out && (
                                        <div className="text-xs sm:text-sm text-red-600 flex items-center">
                                          <span>Out: {rec.out.name} ({rec.out.proj.toFixed(1)})</span>
                                          <StarterBadge p={rec.out} />
                                        </div>
                                      )}
                                      <span className="text-muted-foreground hidden sm:inline">→</span>
                                      <div className="text-xs sm:text-sm text-green-600 flex items-center">
                                        <span>In: {rec.in.name} ({rec.in.proj.toFixed(1)})</span>
                                        <StarterBadge p={rec.in} />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {league.recommendations && league.recommendations.length === 0 && (
                              <div className="text-center text-muted-foreground py-4" data-testid={`no-changes-${league.leagueId}`}>
                                Your lineup is already optimal!
                              </div>
                            )}

                            {/* Waiver Watchlist */}
                            {league.waiverSuggestions && league.waiverSuggestions.length > 0 && (
                              <div className="mt-4 rounded-lg border p-4 bg-background" data-testid={`waiver-watchlist-${league.leagueId}`}>
                                <h4 className="font-semibold mb-3">Waiver Watchlist</h4>
                                <ul className="space-y-2">
                                  {league.waiverSuggestions.map((s, idx) => (
                                    <li
                                      key={`${s.slot}-${s.inP.player_id}-${idx}`}
                                      className="flex flex-wrap items-center justify-between rounded-md border p-3 hover:bg-muted/50 transition-colors"
                                      data-testid={`waiver-suggestion-${league.leagueId}-${idx}`}
                                    >
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-green-700 font-medium">
                                            Add {s.inP.name}
                                          </span>
                                          <span className="text-xs text-muted-foreground">
                                            ({s.inP.pos} → {s.slot})
                                          </span>
                                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                            +{s.delta.toFixed(1)} pts
                                          </Badge>
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                          over {s.outP.name} ({s.outP.pos}, {s.outP.proj.toFixed(1)} pts)
                                        </div>
                                      </div>
                                      <a
                                        className="text-sm underline text-primary hover:text-primary/80 whitespace-nowrap"
                                        href={`https://sleeper.com/leagues/${league.leagueId}/players/${s.inP.player_id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        data-testid={`waiver-link-${league.leagueId}-${idx}`}
                                      >
                                        View in Sleeper
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {(!league.waiverSuggestions || league.waiverSuggestions.length === 0) && (
                              <div className="mt-4 text-sm text-muted-foreground text-center py-3" data-testid={`no-waiver-suggestions-${league.leagueId}`}>
                                No obvious waiver upgrades (≥ +1.5 pts)
                              </div>
                            )}
                          </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
