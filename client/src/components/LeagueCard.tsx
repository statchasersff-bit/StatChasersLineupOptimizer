import React, { useMemo, useState } from "react";
import type { LeagueSummary } from "../lib/types";
import { statusFlags } from "../lib/optimizer";
import { buildLineupDiff } from "../lib/diff";
import { AutoSubChip, AutoSubBanner } from "./ui/auto-sub-chip";
import { StarterBadge } from "./StarterBadge";
import { motion, AnimatePresence } from "framer-motion";
import { CollapsibleSection } from "./CollapsibleSection";
import { LineupComparison } from "./LineupComparison";

// Helper function to generate initials from league name
function getLeagueInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// Helper function to generate consistent color based on league name
function getLeagueColor(name: string): string {
  const colors = [
    'bg-blue-500 text-white',
    'bg-green-500 text-white',
    'bg-purple-500 text-white',
    'bg-pink-500 text-white',
    'bg-indigo-500 text-white',
    'bg-teal-500 text-white',
    'bg-orange-500 text-white',
    'bg-cyan-500 text-white',
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

export default function LeagueCard({ lg }: { lg: LeagueSummary }) {
  const [open, setOpen] = useState(false);

  // TRUE ins/outs based on sets, not slot-by-slot
  const diff = useMemo(() => buildLineupDiff(lg, lg.allEligible, lg.irList), [lg]);
  
  const leagueInitials = getLeagueInitials(lg.name);
  const leagueColor = getLeagueColor(lg.name);

  return (
    <div className="rounded-2xl shadow border" data-testid={`card-league-${lg.league_id}`}>
      {/* Auto-Sub Banner */}
      {lg.autoSubConfig && (
        <AutoSubBanner 
          enabled={lg.autoSubConfig.enabled}
          requireLaterStart={lg.autoSubConfig.requireLaterStart}
          allowedPerWeek={lg.autoSubConfig.allowedPerWeek}
        />
      )}
      
      {/* Header Row (always visible) */}
      <button
        className="w-full flex items-start sm:items-center p-3 sm:p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 rounded-2xl transition-colors gap-3 sm:gap-4"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        data-testid={`button-toggle-${lg.league_id}`}
      >
        {/* League Avatar */}
        <div 
          className={`flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full ${leagueColor} flex items-center justify-center font-bold text-sm sm:text-base shadow-md`}
          data-testid={`avatar-${lg.league_id}`}
        >
          {leagueInitials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-xs sm:text-sm text-gray-500 truncate" data-testid={`text-manager-${lg.league_id}`}>{lg.rosterUserDisplay}</div>
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h3 
              className="text-sm sm:text-base md:text-lg font-semibold truncate max-w-[200px] sm:max-w-[300px] md:max-w-full" 
              data-testid={`text-league-name-${lg.league_id}`}
              title={lg.name}
            >
              {lg.name}
            </h3>
            {(lg.outByeEmptyCount ?? 0) > 0 && (
              <span className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full bg-red-500 text-white shadow-sm whitespace-nowrap" data-testid={`badge-out-bye-empty-${lg.league_id}`}>
                OUT/BYE/EMPTY: {lg.outByeEmptyCount}
              </span>
            )}
            {(lg.quesCount ?? 0) > 0 && (
              <span className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full bg-yellow-500 text-white shadow-sm whitespace-nowrap" data-testid={`badge-ques-${lg.league_id}`}>
                QUES: {lg.quesCount}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
          {/* potential points gain (delta) */}
          <div className={`text-sm sm:text-base font-semibold ${lg.delta >= 0 ? "text-green-600" : "text-red-600"}`} data-testid={`text-delta-${lg.league_id}`}>
            {lg.delta >= 0 ? "+" : ""}{lg.delta.toFixed(1)} pts
          </div>

          {/* Auto-sub badge */}
          {lg.autoSubConfig && lg.autoSubConfig.enabled && lg.autoSubConfig.allowedPerWeek && (
            <span className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full bg-blue-500 text-white shadow-sm whitespace-nowrap" data-testid={`badge-auto-sub-${lg.league_id}`}>
              {lg.autoSubConfig.allowedPerWeek}/week max
            </span>
          )}
          
          {/* Bench empties badge */}
          {(lg.benchEmpty ?? 0) > 0 && (
            <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-400 text-white shadow-sm whitespace-nowrap" data-testid={`badge-bench-empty-${lg.league_id}`}>
              {lg.benchEmpty} empty {lg.benchEmpty === 1 ? "spot" : "spots"}
            </span>
          )}

          <svg className={`h-4 w-4 sm:h-5 sm:w-5 transition-transform ${open ? "rotate-180" : "rotate-0"}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.061l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.06z" />
          </svg>
        </div>
      </button>

      {/* Matchup Preview Bar (Win Probability Indicator) */}
      {lg.opponent && lg.winProbability !== undefined && (
        <div className="px-3 sm:px-4 pb-2">
          <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className={`h-full motion-safe:transition-all motion-safe:duration-500 rounded-full ${
                lg.winProbability >= 70 ? 'bg-gradient-to-r from-green-400 to-green-600' :
                lg.winProbability >= 30 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                'bg-gradient-to-r from-red-400 to-red-600'
              }`}
              style={{ width: `${lg.winProbability}%` }}
              data-testid={`bar-win-probability-${lg.league_id}`}
            >
            </div>
          </div>
          <div className="text-xs text-center mt-1 text-gray-600 dark:text-gray-400">
            {lg.winProbability}% win probability
          </div>
        </div>
      )}

      {/* Detail (collapsible with smooth animation) */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="p-3 sm:p-4 pt-0 space-y-3">
              {/* Lineup Comparison Section */}
              <CollapsibleSection
                title="Lineup Comparison"
                subtitle="Current vs. Optimal"
                defaultOpen={true}
              >
                <div className="mt-3">
                  <LineupComparison lg={lg} />
                </div>
              </CollapsibleSection>

              {/* Suggested Changes Section */}
              {diff.moves.length > 0 && (
                <CollapsibleSection
                  title="Suggested Changes"
                  subtitle={`${diff.moves.length} recommendation${diff.moves.length !== 1 ? 's' : ''}`}
                  defaultOpen={true}
                >
                  <ul className="space-y-2 mt-3">
                    {diff.moves.map((m, i) => {
                      // Check if the incoming player is a FA
                      const inPlayer = lg.allEligible?.find(p => p.player_id === m.in_pid);
                      const isFA = (inPlayer as any)?.isFA === true;
                      const fromIR = m.fromIR === true;
                      
                      // Check if out_name is an empty slot (starts with "player_id" or out_pid is "0")
                      const isEmptySlot = !m.out_name || m.out_pid === "0" || m.out_name.startsWith("player_id");
                      
                      return (
                        <li key={i} className="py-2 border-b border-border last:border-0" data-testid={`row-suggestion-${i}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1">
                              {isFA ? (
                                <div>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 mb-1">
                                    Add FA
                                  </span>
                                  <div className="mt-1">
                                    <span className="font-bold">{m.in_name}</span>
                                    <span className="text-muted-foreground text-sm"> → {m.slot}</span>
                                  </div>
                                  {m.out_name && !isEmptySlot && (
                                    <div className="text-xs text-muted-foreground mt-0.5">Replace {m.out_name}</div>
                                  )}
                                </div>
                              ) : fromIR ? (
                                <div>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 mb-1">
                                    From IR
                                  </span>
                                  <div className="mt-1">
                                    <span className="font-bold">{m.in_name}</span>
                                    <span className="text-muted-foreground text-sm"> → {m.slot}</span>
                                  </div>
                                  {m.out_name && !isEmptySlot && (
                                    <div className="text-xs text-muted-foreground mt-0.5">Bench {m.out_name}</div>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  <div>
                                    <span className="font-bold">{m.in_name}</span>
                                    <span className="text-muted-foreground text-sm"> → {m.slot}</span>
                                  </div>
                                  {m.out_name && !isEmptySlot && (
                                    <div className="text-xs text-muted-foreground mt-0.5">Bench {m.out_name}</div>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                              +{m.gain.toFixed(1)}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </CollapsibleSection>
              )}

              {/* Matchup Section */}
              {lg.opponent && (
                <CollapsibleSection
                  title="This Week's Matchup"
                  subtitle={`${lg.projectedWin === true ? 'Projected Win' : lg.projectedWin === false ? 'Projected Loss' : 'Projected Tie'}`}
                  defaultOpen={true}
                >
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground mb-1">You (Optimal)</div>
                        <div className="font-bold text-sm mb-0.5">{lg.rosterUserDisplay}</div>
                        <div className="text-2xl font-bold text-foreground">{lg.optimalTotal.toFixed(1)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground mb-1">Opponent</div>
                        <div className="font-bold text-sm mb-0.5">{lg.opponent.teamName}</div>
                        <div className="text-2xl font-bold text-foreground">{lg.opponent.currentTotal.toFixed(1)}</div>
                      </div>
                    </div>

                    {(lg.projectedWin !== undefined || (lg.opponent && lg.pointDifferential === 0)) && (
                      <div className={`text-center py-2 px-3 rounded-lg ${
                        lg.projectedWin === true ? 'bg-green-50 dark:bg-green-950/20' : 
                        lg.projectedWin === false ? 'bg-red-50 dark:bg-red-950/20' : 
                        'bg-yellow-50 dark:bg-yellow-950/20'
                      }`}>
                        <div className={`font-semibold ${
                          lg.projectedWin === true ? 'text-green-600 dark:text-green-400' : 
                          lg.projectedWin === false ? 'text-red-600 dark:text-red-400' : 
                          'text-yellow-600 dark:text-yellow-400'
                        }`} data-testid={`text-projection-${lg.league_id}`}>
                          {lg.projectedWin === true ? 'Projected Win' : 
                           lg.projectedWin === false ? 'Projected Loss' : 
                           'Projected Tie'}
                          {lg.pointDifferential !== undefined && (
                            <span className="ml-2 text-sm">
                              ({lg.pointDifferential > 0 ? '+' : lg.pointDifferential < 0 ? '' : ''}{lg.pointDifferential.toFixed(1)} pts)
                            </span>
                          )}
                        </div>
                        {lg.winProbability !== undefined && (
                          <div className="mt-1 text-sm text-muted-foreground" data-testid={`text-win-probability-${lg.league_id}`}>
                            {lg.winProbability}% win probability
                          </div>
                        )}
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground text-center border-t border-border pt-2">
                      Bench: {lg.benchCount ?? 0}/{lg.benchCapacity ?? 0}
                      {(lg.benchEmpty ?? 0) > 0 && <> • <span className="text-amber-600">{lg.benchEmpty} empty</span></>}
                    </div>
                  </div>
                </CollapsibleSection>
              )}

              {(() => {
                // Blocklist of non-active players to exclude from waiver recommendations
                const WAIVER_BLOCKLIST = new Set([
                  "Donnie Ernsberger",
                  "Mark McNamee",
                ]);
                
                // Get FAs from suggested changes
                const suggestedFAIds = new Set(
                  diff.moves
                    .map(m => lg.allEligible?.find(p => p.player_id === m.in_pid))
                    .filter(p => (p as any)?.isFA === true)
                    .map(p => p?.player_id)
                    .filter(Boolean) as string[]
                );
                
                // Get all FAs not already in suggested changes, grouped by position
                const allFAs = (lg.allEligible || [])
                  .filter(p => {
                    // Must be a FA and not already suggested
                    if (!(p as any)?.isFA || suggestedFAIds.has(p.player_id)) return false;
                    // Exclude blocklisted players
                    if (WAIVER_BLOCKLIST.has(p.name)) return false;
                    return true;
                  });
                
                // Group by position and take top 3 per position
                const byPosition = new Map<string, typeof allFAs>();
                for (const fa of allFAs) {
                  const pos = fa.pos;
                  if (!byPosition.has(pos)) byPosition.set(pos, []);
                  byPosition.get(pos)!.push(fa);
                }
                
                // Sort each position by projection and take top 3
                const otherFAs: typeof allFAs = [];
                for (const [pos, fas] of Array.from(byPosition.entries())) {
                  const topN = fas
                    .sort((a, b) => (b.proj ?? 0) - (a.proj ?? 0))
                    .slice(0, 3);
                  otherFAs.push(...topN);
                }
                
                // Sort final list by projection
                otherFAs.sort((a, b) => (b.proj ?? 0) - (a.proj ?? 0));
                
                return otherFAs.length > 0 && (
                  <CollapsibleSection
                    title="Waiver Watchlist"
                    subtitle="Other highly projected free agents"
                    defaultOpen={false}
                  >
                    <ul className="space-y-2 mt-3">
                      {otherFAs.map((fa, i) => (
                        <li key={i} className="py-2 border-b border-border last:border-0" data-testid={`row-waiver-${i}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm">{fa.name}</span>
                                <span className="text-xs text-muted-foreground">({fa.pos})</span>
                              </div>
                              <div className="text-sm text-muted-foreground mt-0.5">
                                {fa.proj?.toFixed(1) ?? "0.0"} pts
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CollapsibleSection>
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
