import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ChartLine, Settings, Search, Users, TrendingUp, AlertTriangle, FileSpreadsheet, Download, Share, Code, ChevronDown, Table as TableIcon } from "lucide-react";
import { getUserByName, getUserLeagues, getLeagueRosters, getLeagueUsers, getLeagueDetails, getLeagueMatchups, getPlayersIndex, getLeagueMatchupsForLocking } from "@/lib/sleeper";
import { buildProjectionIndex, normalizePos } from "@/lib/projections";
import { buildSlotCounts, toPlayerLite, optimizeLineup, sumProj, statusFlags } from "@/lib/optimizer";
import { isPlayerLocked, getWeekSchedule, isTeamOnBye, type GameSchedule } from "@/lib/gameLocking";
import { isBestBallLeague } from "@/lib/isBestBall";
import { isDynastyLeague } from "@/lib/isDynasty";
import { scoreByLeague } from "@/lib/scoring";
import { buildFreeAgentPool, getOwnedPlayerIds } from "@/lib/freeAgents";
import { loadBuiltInOrSaved, findLatestWeek } from "@/lib/builtin";
import { saveProjections, loadProjections } from "@/lib/storage";
import { getLeagueAutoSubConfig, findAutoSubRecommendations } from "@/lib/autoSubs";
import { summarizeStarters, type Starter } from "@/lib/availability";
import type { LeagueSummary, Projection, WaiverSuggestion } from "@/lib/types";

// Calculate win probability based on point differential using realistic fantasy football variance
function calculateWinProbability(pointDifferential: number): number {
  if (pointDifferential === 0) return 50; // Tie = 50% chance
  
  // Typical fantasy scoring has ~30 points standard deviation per team
  // For the difference between two teams: sqrt(30^2 + 30^2) ≈ 42.4
  const teamStdDev = 30;
  const combinedStdDev = Math.sqrt(teamStdDev * teamStdDev + teamStdDev * teamStdDev); // ≈ 42.43
  
  // Calculate Z-score: how many standard deviations is the point differential
  const z = pointDifferential / combinedStdDev;
  
  // Use more accurate normal CDF approximation (Abramowitz and Stegun)
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const polynomial = 0.319381530 * t - 0.356563782 * t * t + 1.781477937 * t * t * t - 1.821255978 * t * t * t * t + 1.330274429 * t * t * t * t * t;
  const cdf = z >= 0 ? 1 - (0.3989423 * Math.exp(-0.5 * z * z) * polynomial) : 0.3989423 * Math.exp(-0.5 * z * z) * polynomial;
  
  // Convert to percentage and clamp between 1-99%
  return Math.max(1, Math.min(99, Math.round(cdf * 100)));
}
import LeagueCard from "@/components/LeagueCard";
import { LeagueListSkeleton } from "@/components/ui/league-skeleton";
import { AutoSubBanner } from "@/components/ui/auto-sub-chip";
import AdminModal from "@/components/AdminModal";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [, setLocation] = useLocation();
  const [season, setSeason] = useState("2025");
  const [week, setWeek] = useState<string>(""); // Will be auto-detected
  const [username, setUsername] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [playersIndex, setPlayersIndex] = useState<Record<string, any> | null>(null);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [summaries, setSummaries] = useState<LeagueSummary[]>([]);
  const [considerWaivers, setConsiderWaivers] = useState(true);
  const [filterDynasty, setFilterDynasty] = useState(false);
  const [sortAlphabetical, setSortAlphabetical] = useState(false);
  const [usingSavedMsg, setUsingSavedMsg] = useState<string | null>(null);
  const [projections, setProjections] = useState<Projection[]>([]);
  const { toast } = useToast();

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

  // Re-sort summaries when alphabetical sort preference changes
  const sortedSummaries = useMemo(() => {
    return sortAlphabetical 
      ? [...summaries].sort((a, b) => a.name.localeCompare(b.name))
      : [...summaries].sort((a, b) => b.delta - a.delta);
  }, [summaries, sortAlphabetical]);

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

      // EXCLUDE Best Ball leagues by default and optionally dynasty leagues
      let filteredLeagues = lgs.filter((lg) => !isBestBallLeague(lg));
      const bestBallCount = lgs.length - filteredLeagues.length;
      if (bestBallCount > 0) {
        console.log(`[Home] Filtered out ${bestBallCount} Best Ball leagues`);
      }
      
      if (filterDynasty) {
        const beforeDynastyFilter = filteredLeagues.length;
        filteredLeagues = filteredLeagues.filter((lg) => !isDynastyLeague(lg));
        const dynastyCount = beforeDynastyFilter - filteredLeagues.length;
        if (dynastyCount > 0) {
          console.log(`[Home] Filtered out ${dynastyCount} Dynasty leagues`);
        }
      }
      
      console.log(`[Home] Processing ${filteredLeagues.length} leagues after filtering`);
      setLeagues(filteredLeagues);
      
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
            
            // Determine opponent - for defenses without projections, check if team is on BYE
            let opp = pr?.opp;
            if (!opp && lite.pos === "DEF" && lite.team) {
              opp = isTeamOnBye(lite.team, schedule) ? "BYE" : undefined;
            }
            
            return { ...lite, proj: displayProj, opp, locked, actualPoints: actual };
          };

          const starterObjs = validStarters.map(addWithProj).filter(Boolean) as any[];
          const benchObjs = bench.map(addWithProj).filter(Boolean) as any[];
          let allEligible = [...starterObjs, ...benchObjs];

          // If considerWaivers is enabled, fetch and merge free agents into the candidate pool
          if (considerWaivers) {
            try {
              const { buildFACandidates } = await import("@/lib/faIntegration");
              const owned = new Set<string>();
              rosters.forEach((roster: any) => {
                (roster.players || []).forEach((pid: string) => owned.add(pid));
              });

              const faCandidates = await buildFACandidates(owned, currentPlayersIndex, projIdx, scoring, schedule, playedPlayerIds);
              
              // Merge FAs into allEligible, filtering out duplicates
              const existingIds = new Set(allEligible.map(p => p.player_id));
              const newFAs = faCandidates.filter(fa => !existingIds.has(fa.player_id));
              allEligible = [...allEligible, ...newFAs];
            } catch (err) {
              console.error("[FA Integration] Error fetching free agents:", err);
            }
          }

          const optimalSlots = optimizeLineup(slotCounts, allEligible, season, week, starters);
          const optimalTotal = sumProj(optimalSlots);

          // Calculate current total
          const fixedSlots = roster_positions.filter((s: string) => !["BN","IR","TAXI"].includes(s));
          const currentSlots = starters.slice(0, fixedSlots.length).map((pid, i) => {
            if (!pid) return { slot: fixedSlots[i] }; // Handle empty slots
            const player = addWithProj(pid);
            if (!player) return { slot: fixedSlots[i] };
            return { slot: fixedSlots[i], player };
          });
          const currentTotal = sumProj(currentSlots as any);

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
          // Identify IR and Taxi players (don't count them toward BN)
          const irList: string[] = (meRoster?.reserve || []).filter(Boolean);
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
                
                const opponentTotal = sumProj(opponentCurrentSlots as any);
                
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
            waiverSuggestions,
            starterObjs, // Include enriched starter objects with names
            allEligible, // Include all player objects for lookup
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
            winProbability
          });
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
        }
      }

      setSummaries(out);
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

  return (
    <div className="bg-background text-foreground min-h-screen">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-4 gap-3">
            <div className="flex items-center space-x-2">
              <ChartLine className="text-primary w-6 h-6 sm:w-8 sm:h-8" />
              <h1 className="text-lg sm:text-xl font-bold text-foreground" data-testid="text-app-title">StatChasers Lineup Checker</h1>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <label className="text-muted-foreground">Season:</label>
                <input
                  className="border rounded px-2 py-1 w-16 text-center"
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  data-testid="input-season"
                />
                <label className="text-muted-foreground">Week:</label>
                <input
                  className="border rounded px-2 py-1 w-12 text-center"
                  value={week}
                  onChange={(e) => setWeek(e.target.value)}
                  data-testid="input-week"
                />
              </div>
              <button 
                className="bg-primary text-primary-foreground px-3 sm:px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* User Input Section */}
        <div className="card rounded-lg border border-border shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Users className="w-5 h-5 mr-2 text-primary" />
            Sleeper Account Setup
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Sleeper Username</label>
              <input 
                type="text" 
                placeholder="Enter username..." 
                className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                data-testid="input-username"
              />
            </div>
            
            <div className="flex items-end gap-2">
              <button 
                className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                onClick={handleAnalyzeLineups}
                disabled={isAnalyzing}
                data-testid="button-analyze"
              >
                {isAnalyzing ? (
                  <div className="loading-spinner w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">{isAnalyzing ? "Analyzing..." : "Analyze Lineups"}</span>
                <span className="sm:hidden">{isAnalyzing ? "..." : "Analyze"}</span>
              </button>
              {username.trim() && (
                <button
                  className="bg-secondary text-secondary-foreground px-3 sm:px-4 py-2 rounded-md font-medium hover:bg-secondary/90 transition-colors flex items-center gap-2"
                  onClick={() => setLocation(`/${username.trim()}/matchups`)}
                  data-testid="button-table-view"
                  title="View Table Summary"
                >
                  <TableIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">Table</span>
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-sm" data-testid="checkbox-waivers">
              <input
                type="checkbox"
                checked={considerWaivers}
                onChange={(e) => setConsiderWaivers(e.target.checked)}
                className="rounded border-input"
              />
              Consider Free Agents
            </label>
            
            <label className="flex items-center gap-2 text-sm" data-testid="checkbox-dynasty">
              <input
                type="checkbox"
                checked={filterDynasty}
                onChange={(e) => setFilterDynasty(e.target.checked)}
                className="rounded border-input"
              />
              Filter Dynasty Leagues
            </label>
            
            <label className="flex items-center gap-2 text-sm" data-testid="checkbox-alphabetical">
              <input
                type="checkbox"
                checked={sortAlphabetical}
                onChange={(e) => setSortAlphabetical(e.target.checked)}
                className="rounded border-input"
              />
              Sort Alphabetically
            </label>

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

        {/* Status Section */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
          <div className="card rounded-lg border border-border p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold text-primary" data-testid="text-active-leagues">{summaries.length}</div>
            <div className="text-xs sm:text-sm text-muted-foreground">Active Leagues</div>
          </div>
          <div className="card rounded-lg border border-border p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold text-accent" data-testid="text-total-potential">+{totalPotentialPoints.toFixed(1)}</div>
            <div className="text-xs sm:text-sm text-muted-foreground">Total Potential Pts</div>
          </div>
          <div className="card rounded-lg border border-border p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-out-bye-empty">{totalOutByeEmpty}</div>
            <div className="text-xs sm:text-sm text-muted-foreground">OUT/BYE/EMPTY</div>
          </div>
          <div className="card rounded-lg border border-border p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold text-yellow-600 dark:text-yellow-400" data-testid="text-ques-doub">{totalQues}</div>
            <div className="text-xs sm:text-sm text-muted-foreground">QUES/DOUB</div>
          </div>
          <div className="card rounded-lg border border-border p-3 sm:p-4 text-center col-span-2 sm:col-span-1">
            <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400" data-testid="text-projected-record">
              {projectedRecord.wins + projectedRecord.losses + projectedRecord.ties > 0 
                ? `${projectedRecord.wins}-${projectedRecord.losses}${projectedRecord.ties > 0 ? `-${projectedRecord.ties}` : ''}` 
                : '--'}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">Projected Record</div>
            {projectedRecord.noMatchup > 0 && (
              <div className="text-xs text-gray-500">{projectedRecord.noMatchup} no matchup</div>
            )}
          </div>
        </div>

        {/* Leagues Analysis Section */}
        <section className="space-y-3">
          {isAnalyzing ? (
            <LeagueListSkeleton />
          ) : sortedSummaries.length > 0 ? (
            <>
              {sortedSummaries.map((lg) => <LeagueCard key={lg.league_id} lg={lg} />)}
            </>
          ) : (
            <div className="text-center text-muted-foreground py-12">
              <ChartLine className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg mb-2">Ready to optimize your lineups?</p>
              <p className="text-sm">
                Enter your Sleeper username and click <strong>Analyze Lineups</strong> to get started.
              </p>
            </div>
          )}
        </section>

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
    </div>
  );
}
