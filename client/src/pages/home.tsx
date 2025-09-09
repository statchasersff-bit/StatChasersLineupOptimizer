import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChartLine, Settings, Search, Users, TrendingUp, AlertTriangle, FileSpreadsheet, Download, Share, Code, ChevronDown } from "lucide-react";
import { getUserByName, getUserLeagues, getLeagueRosters, getLeagueUsers, getLeagueDetails, getPlayersIndex } from "@/lib/sleeper";
import { buildProjectionIndex, normalizePos } from "@/lib/projections";
import { buildSlotCounts, toPlayerLite, optimizeLineup, sumProj } from "@/lib/optimizer";
import { isBestBallLeague } from "@/lib/isBestBall";
import { isDynastyLeague } from "@/lib/isDynasty";
import { scoreByLeague } from "@/lib/scoring";
import { buildFreeAgentPool, getOwnedPlayerIds } from "@/lib/freeAgents";
import type { LeagueSummary, Projection, WaiverSuggestion } from "@/lib/types";
import LeagueCard from "@/components/LeagueCard";
import AdminModal from "@/components/AdminModal";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const season = "2025";
  const week = "2"; // Current NFL week
  const [username, setUsername] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [playersIndex, setPlayersIndex] = useState<Record<string, any> | null>(null);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [summaries, setSummaries] = useState<LeagueSummary[]>([]);
  const [considerWaivers, setConsiderWaivers] = useState(true);
  const [filterDynasty, setFilterDynasty] = useState(false);
  const [sortAlphabetical, setSortAlphabetical] = useState(false);
  const { toast } = useToast();

  // Fetch projections from our API
  const { data: projectionsData = [] } = useQuery<Projection[]>({
    queryKey: ['/api/projections', season, week]
  });

  const projIdx = useMemo(() => {
    return buildProjectionIndex(projectionsData);
  }, [projectionsData]);

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

    if (projectionsData.length === 0) {
      toast({ title: "Error", description: "No projections available for this week", variant: "destructive" });
      return;
    }

    setIsAnalyzing(true);
    try {
      const user = await getUserByName(username.trim());
      const lgs = await getUserLeagues(user.user_id, season);

      // EXCLUDE Best Ball leagues by default and optionally dynasty leagues
      let filteredLeagues = lgs.filter((lg) => !isBestBallLeague(lg));
      if (filterDynasty) {
        filteredLeagues = filteredLeagues.filter((lg) => !isDynastyLeague(lg));
      }
      setLeagues(filteredLeagues);
      
      if (!playersIndex) {
        const idx = await getPlayersIndex();
        setPlayersIndex(idx);
      }

      // Process each league
      const out: LeagueSummary[] = [];
      const currentPlayersIndex = playersIndex || await getPlayersIndex();

      for (const lg of filteredLeagues) {
        try {
          const [rosters, users, leagueDetails] = await Promise.all([
            getLeagueRosters(lg.league_id),
            getLeagueUsers(lg.league_id),
            getLeagueDetails(lg.league_id),
          ]);

          // Find user's roster
          const meRoster = rosters.find((r: any) => r.owner_id === lg.user_id) || 
                          rosters.find((r: any) => r.roster_id === lg.roster_id) || 
                          rosters[0];
          const owner = users.find((u: any) => u.user_id === meRoster?.owner_id);
          const display = owner?.metadata?.team_name || owner?.display_name || "Unknown Manager";

          const roster_positions: string[] = leagueDetails?.roster_positions || lg.roster_positions || [];
          const slotCounts = buildSlotCounts(roster_positions);

          // Keep original starter structure (including empty slots) for display
          const starters: (string | null)[] = (meRoster?.starters || []);
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
              const stats = (pr as any).stats || {};
              const originalProj = pr.proj;
              adj = scoreByLeague(lite.pos, stats, scoring, pr.proj);
              
              // Debug: Log Dallas Goedert specifically
              if (lite.name === "Dallas Goedert") {
                console.log(`Dallas Goedert calculation: Original=${originalProj}, Adjusted=${adj}, Position=${lite.pos}`);
                console.log(`Stats used:`, stats);
              }
            } else {
              adj = 0; // no projection found
            }

            return { ...lite, proj: adj, opp: pr?.opp };
          };

          const starterObjs = validStarters.map(addWithProj).filter(Boolean) as any[];
          const benchObjs = bench.map(addWithProj).filter(Boolean) as any[];
          const allEligible = [...starterObjs, ...benchObjs];

          const optimalSlots = optimizeLineup(slotCounts, allEligible);
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
            });

            // Score the FA pool using league scoring
            const scoredFAs: Record<string, { player_id: string; name: string; team?: string; pos: string; proj: number; opp?: string }[]> = {};
            for (const pos of Object.keys(faByPos)) {
              scoredFAs[pos] = faByPos[pos].map((fa) => {
                // look up full projection row by id (for stat-level)
                const pr = projIdx[fa.player_id];
                const stats = (pr as any)?.stats || {};
                const adj = scoreByLeague(pos, stats, scoring, pr?.proj ?? fa.proj);
                return { ...fa, proj: adj };
              }).sort((a, b) => (b.proj ?? 0) - (a.proj ?? 0));
            }

            // For each starting slot, see if the best eligible FA beats your optimal player
            // 1) map slot → current optimal player/proj
            const slotToOptimal: Record<string, number> = {};
            optimalSlots.forEach(s => {
              slotToOptimal[s.slot] = Math.max(slotToOptimal[s.slot] ?? 0, s.player?.proj ?? 0);
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
              const s = slot.toUpperCase();
              const p = pos.toUpperCase();
              if (isFlex(s)) return (FLEX_ELIG[s] || []).includes(p);
              return s === p;
            };

            // 3) For each slot type in your starting lineup, find best FA eligible
            const seen: Record<string, boolean> = {};
            const optimalIds = new Set(optimalSlots.map(s => s.player?.player_id).filter(Boolean) as string[]);
            
            for (const slot of Object.keys(slotToOptimal)) {
              let bestFA: any = null;

              // Choose from scoredFAs across positions that can fill this slot
              for (const pos of Object.keys(scoredFAs)) {
                if (!canFill(slot, pos)) continue;
                for (const cand of scoredFAs[pos]) {
                  const key = cand.player_id; // avoid suggesting same FA for multiple slots
                  if (seen[key]) continue;
                  if (optimalIds.has(cand.player_id)) continue; // skip suggesting someone already starting optimally
                  bestFA = bestFA && bestFA.proj > cand.proj ? bestFA : cand;
                }
              }

              if (bestFA) {
                const current = slotToOptimal[slot] ?? 0;
                const gain = (bestFA.proj ?? 0) - current;
                if (gain > 0.2) { // small threshold to avoid noise
                  waiverSuggestions.push({
                    player_id: bestFA.player_id,
                    name: bestFA.name,
                    team: bestFA.team,
                    pos: bestFA.pos,
                    proj: bestFA.proj,
                    opp: bestFA.opp,
                    replaceSlot: slot,
                    gain,
                  });
                  seen[bestFA.player_id] = true;
                }
              }
            }

            waiverSuggestions.sort((a, b) => b.gain - a.gain);
          }

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
          });
        } catch (err) {
          console.warn("League failed", lg?.name, err);
        }
      }

      setSummaries(out);
      toast({ title: "Success", description: `Analyzed ${out.length} leagues successfully` });
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
  const riskyStarters = sortedSummaries.reduce((count, s) => 
    count + s.optimalSlots.filter(slot => {
      const p = slot.player;
      if (!p) return false;
      const status = (p.injury_status || "").toUpperCase();
      const opp = (p.opp || "").toUpperCase();
      return status.includes("OUT") || status.includes("DOU") || status.includes("SUS") || opp === "BYE";
    }).length, 0
  );
  const totalChanges = sortedSummaries.reduce((count, s) => 
    count + s.optimalSlots.filter((slot, i) => s.starters[i] !== slot.player?.player_id).length, 0
  );

  return (
    <div className="bg-background text-foreground min-h-screen">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <ChartLine className="text-primary text-2xl w-8 h-8" />
                <h1 className="text-xl font-bold text-foreground" data-testid="text-app-title">StatChasers Lineup Checker</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground" data-testid="text-current-week">Week {week} • {season} Season</span>
              <button 
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
                onClick={() => setShowAdminModal(true)}
                data-testid="button-admin"
              >
                <Settings className="w-4 h-4" />
                Admin
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
            
            <div className="flex items-end">
              <button 
                className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                onClick={handleAnalyzeLineups}
                disabled={isAnalyzing}
                data-testid="button-analyze"
              >
                {isAnalyzing ? (
                  <div className="loading-spinner w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {isAnalyzing ? "Analyzing..." : "Analyze Lineups"}
              </button>
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
          
          <div className="mt-3 text-xs text-muted-foreground">
            Using StatChasers projections for Week {week}. {projectionsData.length} players available.
          </div>
        </div>

        {/* Status Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="card rounded-lg border border-border p-4 text-center">
            <div className="text-2xl font-bold text-primary" data-testid="text-active-leagues">{summaries.length}</div>
            <div className="text-sm text-muted-foreground">Active Leagues</div>
          </div>
          <div className="card rounded-lg border border-border p-4 text-center">
            <div className="text-2xl font-bold text-accent" data-testid="text-total-potential">+{totalPotentialPoints.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground">Total Potential Pts</div>
          </div>
          <div className="card rounded-lg border border-border p-4 text-center">
            <div className="text-2xl font-bold text-destructive" data-testid="text-risky-starters">{riskyStarters}</div>
            <div className="text-sm text-muted-foreground">Risky Starters</div>
          </div>
          <div className="card rounded-lg border border-border p-4 text-center">
            <div className="text-2xl font-bold text-chart-3" data-testid="text-lineup-changes">{totalChanges}</div>
            <div className="text-sm text-muted-foreground">Lineup Changes</div>
          </div>
        </div>

        {/* Leagues Analysis Section */}
        <section className="space-y-3">
          {sortedSummaries.length > 0 ? (
            sortedSummaries.map((lg) => <LeagueCard key={lg.league_id} lg={lg} />)
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
              <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium hover:bg-primary/90 transition-colors flex items-center gap-2" data-testid="button-embed">
                <Code className="w-4 h-4" />
                Embed on WordPress
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
              <h3 className="font-semibold mb-3">WordPress Ready</h3>
              <p className="text-sm text-muted-foreground">
                Embed this tool on your WordPress site using iframe or direct integration.
              </p>
              <button className="mt-2 text-primary hover:text-primary/80 text-sm font-medium">
                Get Embed Code →
              </button>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted-foreground">
            © 2024 StatChasers Lineup Checker. Powered by Sleeper API.
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
