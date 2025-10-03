import { useState, useMemo, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { ChevronDown, ChevronRight, AlertTriangle, FileSpreadsheet, ArrowLeft } from "lucide-react";
import { getUserByName, getUserLeagues, getLeagueRosters, getLeagueUsers, getLeagueDetails, getLeagueMatchups, getPlayersIndex, getLeagueMatchupsForLocking } from "@/lib/sleeper";
import { buildProjectionIndex } from "@/lib/projections";
import { buildSlotCounts, toPlayerLite, optimizeLineup, sumProj, statusFlags } from "@/lib/optimizer";
import { isPlayerLocked, getWeekSchedule } from "@/lib/gameLocking";
import { isBestBallLeague } from "@/lib/isBestBall";
import { isDynastyLeague } from "@/lib/isDynasty";
import { scoreByLeague } from "@/lib/scoring";
import { loadBuiltInOrSaved } from "@/lib/builtin";
import { saveProjections, loadProjections } from "@/lib/storage";
import type { Projection } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { summarizeStarters, type Starter, type AvailTag } from "@/lib/availability";
import { OptActCell } from "@/components/OptActCell";
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
  record: string;
  optPoints: number;
  actPoints: number;
  optMinusAct: number;
  projectedResult: "W" | "L" | "N/A";
  margin: number;
  notPlayingCount: number;
  notPlayingList: Array<{ id?: string; name?: string; tag: AvailTag; slot: string }>;
  quesCount: number;
  quesList: Array<{ id?: string; name?: string; slot: string }>;
  currentStarters: any[];
  optimalStarters: any[];
  recommendations: Array<{ out: any; in: any; slot: string; delta: number }>;
  opponentName: string;
  opponentPoints: number;
  warnings: string[];
  waiverSuggestions: WaiverSuggestion[];
  league: any; // Store the full league object for filtering
}

const REDRAFT_KEY = "stc:filter:redraft:on";

export default function MatchupsPage() {
  const params = useParams<{ username: string }>();
  const username = params.username || "";
  const [, setLocation] = useLocation();
  
  const [season, setSeason] = useState("2025");
  const [week, setWeek] = useState("5");
  const [isLoading, setIsLoading] = useState(false);
  const [projections, setProjections] = useState<Projection[]>([]);
  const [leagueMetrics, setLeagueMetrics] = useState<LeagueMetrics[]>([]);
  const [expandedLeagues, setExpandedLeagues] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"optMinusAct" | "projectedResult" | "quesCount" | "notPlayingCount">("optMinusAct");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [redraftOnly, setRedraftOnly] = useState<boolean>(() => {
    const saved = localStorage.getItem(REDRAFT_KEY);
    return saved ? saved === "1" : false;
  });
  const { toast } = useToast();

  // Persist redraft filter preference
  useEffect(() => {
    localStorage.setItem(REDRAFT_KEY, redraftOnly ? "1" : "0");
  }, [redraftOnly]);

  // Load projections on mount and when season/week changes
  useEffect(() => {
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
      setIsLoading(true);
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

      const playersIndex = await getPlayersIndex();
      const playedPlayerIds = await getLeagueMatchupsForLocking(leagues.map(lg => lg.league_id), week);
      const schedule = await getWeekSchedule(season, week);

      const metrics: LeagueMetrics[] = [];

      for (const lg of leagues) {
        try {
          const [rosters, users, leagueDetails, matchups] = await Promise.all([
            getLeagueRosters(lg.league_id),
            getLeagueUsers(lg.league_id),
            getLeagueDetails(lg.league_id),
            getLeagueMatchups(lg.league_id, week),
          ]);

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
            
            return { ...lite, proj: finalProj, opp: pr?.opp, locked, injury_status: lite.injury_status };
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
              proj: player?.proj
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

              // Calculate opponent's optimal points
              const oppActualStarters = (oppMatchup.starters && oppMatchup.starters.length > 0) 
                ? oppMatchup.starters 
                : (oppRoster?.starters || []);
              const oppValidStarters = oppActualStarters.filter((x: any): x is string => !!x);
              const oppBench: string[] = (oppRoster?.players || []).filter((p: string) => p && !oppValidStarters.includes(p));
              const oppStarterObjs = oppValidStarters.map(addWithProj).filter(Boolean) as any[];
              const oppBenchObjs = oppBench.map(addWithProj).filter(Boolean) as any[];
              const oppAllEligible = [...oppStarterObjs, ...oppBenchObjs];
              const oppOptimalSlots = optimizeLineup(slotCounts, oppAllEligible, season, week, oppActualStarters);
              opponentPoints = sumProj(oppOptimalSlots);

              // Compare optimal vs optimal
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

          // Calculate waiver suggestions
          let waiverSuggestions: WaiverSuggestion[] = [];
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

          metrics.push({
            leagueId: lg.league_id,
            leagueName: lg.name,
            format: lg.scoring_settings?.rec === 1 ? "PPR" : lg.scoring_settings?.rec === 0.5 ? "Half" : "Std",
            size: lg.total_rosters || 0,
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
            league: lg,
          });

        } catch (err) {
          console.error(`[Matchups] Error processing league ${lg.league_id}:`, err);
        }
      }

      setLeagueMetrics(metrics);
      setIsLoading(false);
    } catch (err) {
      console.error("[Matchups] Error:", err);
      toast({ title: "Error", description: "Failed to analyze leagues", variant: "destructive" });
      setIsLoading(false);
    }
    };
    
    analyze();
  }, [username, projections, season, week, projIdx, toast]);

  const sortedMetrics = useMemo(() => {
    // Apply redraft filter if enabled (show only non-dynasty leagues)
    let filtered = leagueMetrics;
    if (redraftOnly) {
      filtered = leagueMetrics.filter((metric) => !isDynastyLeague(metric.league));
    }
    
    const sorted = [...filtered].sort((a, b) => {
      let aVal, bVal;
      switch (sortBy) {
        case "optMinusAct":
          aVal = a.optMinusAct;
          bVal = b.optMinusAct;
          break;
        case "projectedResult":
          aVal = a.projectedResult === "W" ? 1 : a.projectedResult === "L" ? 0 : -1;
          bVal = b.projectedResult === "W" ? 1 : b.projectedResult === "L" ? 0 : -1;
          break;
        case "quesCount":
          aVal = a.quesCount;
          bVal = b.quesCount;
          break;
        case "notPlayingCount":
          aVal = a.notPlayingCount;
          bVal = b.notPlayingCount;
          break;
        default:
          aVal = a.optMinusAct;
          bVal = b.optMinusAct;
      }
      return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
    });
    return sorted;
  }, [leagueMetrics, sortBy, sortOrder, redraftOnly]);

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
              size="sm"
              onClick={() => setLocation("/")}
              data-testid="button-back-home"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </div>
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-page-title">StatChasers Lineup Checker</h1>
              <p className="text-muted-foreground mt-1" data-testid="text-username">
                Analyzing leagues for <span className="font-semibold">{username}</span>
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Select value={season} onValueChange={setSeason}>
                <SelectTrigger className="w-32" data-testid="select-season">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={week} onValueChange={setWeek}>
                <SelectTrigger className="w-32" data-testid="select-week">
                  <SelectValue placeholder="Week" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
                    <SelectItem key={w} value={String(w)}>Week {w}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="flex items-center gap-2 border-l pl-3">
                <Switch 
                  id="redraft-only" 
                  checked={redraftOnly} 
                  onCheckedChange={setRedraftOnly}
                  data-testid="switch-redraft-filter"
                />
                <Label htmlFor="redraft-only" className="cursor-pointer text-sm" data-testid="label-redraft-filter">
                  Redraft only
                </Label>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {projections.length > 0 && (
              <Badge variant="outline" className="w-fit" data-testid="badge-projections">
                Using StatChasers projections for Week {week}
              </Badge>
            )}
            {redraftOnly && leagueMetrics.length > 0 && (
              <Badge variant="secondary" className="w-fit" data-testid="badge-redraft-filter">
                Showing redraft leagues only ({sortedMetrics.length} of {leagueMetrics.length})
              </Badge>
            )}
            {!redraftOnly && leagueMetrics.length > 0 && (
              <span className="text-xs text-muted-foreground" data-testid="text-league-count">
                {sortedMetrics.length} {sortedMetrics.length === 1 ? 'league' : 'leagues'}
              </span>
            )}
          </div>
        </div>

        {/* Leagues Table */}
        {isLoading ? (
          <div className="text-center py-12" data-testid="text-loading">
            <p className="text-muted-foreground">Loading leagues...</p>
          </div>
        ) : leagueMetrics.length === 0 ? (
          <div className="text-center py-12" data-testid="text-no-leagues">
            <p className="text-muted-foreground">No leagues found. Make sure you have projections loaded.</p>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>League</TableHead>
                  <TableHead className="text-center">Record</TableHead>
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
                  <>
                    <TableRow
                      key={league.leagueId}
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
                          <div className="font-medium" data-testid={`text-league-name-${league.leagueId}`}>
                            {league.leagueName}
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
                        {league.record}
                      </TableCell>
                      <TableCell className="text-center" data-testid={`text-opt-act-${league.leagueId}`}>
                        <OptActCell optPoints={league.optPoints} actPoints={league.actPoints} />
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Badge
                            variant={league.projectedResult === "W" ? "default" : league.projectedResult === "L" ? "destructive" : "outline"}
                            data-testid={`badge-result-${league.leagueId}`}
                          >
                            {league.projectedResult}
                          </Badge>
                          {league.projectedResult !== "N/A" && (
                            <span className="text-xs text-muted-foreground" data-testid={`text-margin-${league.leagueId}`}>
                              {league.margin > 0 ? "+" : ""}{league.margin.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {league.quesCount > 0 ? (
                          <span className="rounded-full bg-amber-50 text-amber-700 text-xs px-2 py-0.5" data-testid={`badge-ques-${league.leagueId}`}>
                            {league.quesCount}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {league.notPlayingCount > 0 ? (
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
                        <TableCell colSpan={7} className="bg-muted/50 p-6">
                          <div className="space-y-6">
                            {/* Not playing list */}
                            {league.notPlayingCount > 0 && (
                              <div className="my-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-800" data-testid={`not-playing-warning-${league.leagueId}`}>
                                <div className="font-medium">OUT/BYE/EMPTY starters</div>
                                <div className="text-sm">
                                  {league.notPlayingList.map((p, i) => (
                                    <span key={p.id || i}>
                                      {p.name || "—"}{p.tag ? ` (${p.tag})` : ""}{i < league.notPlayingList.length - 1 ? ", " : ""}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Questionable list */}
                            {league.quesCount > 0 && (
                              <div className="my-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900" data-testid={`ques-warning-${league.leagueId}`}>
                                <div className="font-medium">Questionable starters</div>
                                <div className="text-sm">
                                  {league.quesList.map((p, i) => (
                                    <span key={p.id || i}>
                                      {p.name}{i < league.quesList.length - 1 ? ", " : ""}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Opponent Info */}
                            <div className="p-4 bg-background rounded-lg border" data-testid={`opponent-card-${league.leagueId}`}>
                              <h4 className="font-semibold mb-2">Opponent: {league.opponentName}</h4>
                              <p className="text-sm text-muted-foreground">
                                Projected Points: {league.opponentPoints.toFixed(1)}
                              </p>
                            </div>

                            {/* Recommendations */}
                            {league.recommendations.length > 0 && (
                              <div className="space-y-2" data-testid={`recommendations-${league.leagueId}`}>
                                <h4 className="font-semibold">Recommended Changes:</h4>
                                <div className="space-y-2">
                                  {league.recommendations.map((rec, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center gap-3 p-3 bg-background rounded-lg border"
                                      data-testid={`recommendation-${league.leagueId}-${idx}`}
                                    >
                                      {rec.out && (
                                        <div className="text-sm text-red-600">
                                          Out: {rec.out.name} ({rec.out.proj.toFixed(1)})
                                        </div>
                                      )}
                                      <span className="text-muted-foreground">→</span>
                                      <div className="text-sm text-green-600">
                                        In: {rec.in.name} ({rec.in.proj.toFixed(1)})
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {league.recommendations.length === 0 && (
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
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
