import React, { useMemo, useState } from "react";
import type { LeagueSummary } from "../lib/types";
import { statusFlags } from "../lib/optimizer";
import { buildLineupDiff } from "../lib/diff";
import { AutoSubChip, AutoSubBanner } from "./ui/auto-sub-chip";
import { StarterBadge } from "./StarterBadge";
import { motion, AnimatePresence } from "framer-motion";

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
            <div className="p-3 sm:p-4 pt-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <div className="text-sm sm:text-base font-semibold mb-1 sm:mb-2 flex items-center gap-2">
                <span>Current Starters</span>
                <span className="text-xs sm:text-sm font-normal text-muted-foreground">({lg.currentTotal.toFixed(1)} pts)</span>
              </div>
              <ul className="space-y-0.5 sm:space-y-1">
                {lg.starters.map((pid, i) => {
                  const slot = lg.roster_positions[i];
                  
                  // Handle empty slots
                  if (!pid || pid === "0" || pid === "") {
                    return (
                      <li key={i} className="text-xs sm:text-sm p-1 rounded" data-testid={`row-current-${i}`}>
                        <span className="inline-block w-20 sm:w-28 font-mono text-xs sm:text-sm">{slot}</span>
                        <span className="text-gray-400 italic">Empty</span>
                      </li>
                    );
                  }
                  
                  // First try to find in enriched starter objects, then in all eligible players
                  const cur = lg.starterObjs?.find(p => p.player_id === pid) || lg.allEligible?.find(p => p.player_id === pid);
                  const flags = statusFlags(cur);
                  // Only highlight if player is truly being removed from lineup (not in optimal at all)
                  const optimalIds = new Set(lg.optimalSlots.map(s => s.player?.player_id).filter(Boolean));
                  const isBeingBenched = !optimalIds.has(pid);
                  // Find auto-sub recommendation for this starter
                  const autoSubRec = lg.autoSubRecommendations?.find(rec => rec.starter.player_id === pid);
                  
                  return (
                    <li key={i} className={`text-xs sm:text-sm p-1 rounded ${isBeingBenched ? 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300' : ''}`} data-testid={`row-current-${i}`}>
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center flex-wrap gap-1">
                          <span className="inline-block w-20 sm:w-28 font-mono text-xs sm:text-sm">{slot}</span>
                          <span className="text-xs sm:text-sm">{cur ? `${cur.name} (${cur.pos}) — ${cur.proj?.toFixed(2) ?? "0.00"}` : `player_id ${pid}`}</span>
                          <StarterBadge p={cur} />
                        </div>
                        {autoSubRec && (
                          <AutoSubChip 
                            recommendation={autoSubRec}
                            requireLaterStart={lg.autoSubConfig?.requireLaterStart || false}
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <div className="text-sm sm:text-base font-semibold mb-1 sm:mb-2 flex items-center gap-2">
                <span>Optimal Starters</span>
                <span className="text-xs sm:text-sm font-normal text-muted-foreground">({lg.optimalTotal.toFixed(1)} pts)</span>
              </div>
              <ul className="space-y-0.5 sm:space-y-1">
                {lg.optimalSlots.map((s, i) => {
                  const p = s.player;
                  const flags = statusFlags(p);
                  
                  if (!p) {
                    return (
                      <li key={i} className="text-xs sm:text-sm p-1 rounded" data-testid={`row-optimal-${i}`}>
                        <span className="inline-block w-20 sm:w-28 font-mono text-xs sm:text-sm">{s.slot}</span>
                        —
                      </li>
                    );
                  }

                  const currentIds = new Set(lg.starters.filter((x): x is string => !!x));
                  const benchIds = new Set(lg.bench.filter(Boolean));
                  const isCurrentStarter = currentIds.has(p.player_id);
                  const isBenchPlayer = benchIds.has(p.player_id);
                  const isFreeAgent = !isCurrentStarter && !isBenchPlayer;
                  
                  let highlightClass = '';
                  if (isFreeAgent) {
                    highlightClass = 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-300';
                  } else if (isBenchPlayer) {
                    highlightClass = 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-300';
                  }
                  
                  return (
                    <li key={i} className={`text-xs sm:text-sm p-1 rounded ${highlightClass}`} data-testid={`row-optimal-${i}`}>
                      <div className="flex items-center flex-wrap gap-1">
                        <span className="inline-block w-20 sm:w-28 font-mono text-xs sm:text-sm">{s.slot}</span>
                        <span className="text-xs sm:text-sm">{`${p.name} (${p.pos}) — ${p.proj?.toFixed(2) ?? "0.00"}`}</span>
                        <StarterBadge p={p} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* NEW: clear recommendations that avoid self-swaps */}
          {diff.moves.length > 0 && (
            <div className="mt-4">
              <div className="font-semibold mb-1">Suggested Changes</div>
              <ul className="space-y-1">
                {diff.moves.map((m, i) => {
                  // Check if the incoming player is a FA
                  const inPlayer = lg.allEligible?.find(p => p.player_id === m.in_pid);
                  const isFA = (inPlayer as any)?.isFA === true;
                  const fromIR = m.fromIR === true;
                  
                  // Check if out_name is an empty slot (starts with "player_id" or out_pid is "0")
                  const isEmptySlot = !m.out_name || m.out_pid === "0" || m.out_name.startsWith("player_id");
                  
                  return (
                    <li key={i} className="text-sm" data-testid={`row-suggestion-${i}`}>
                      {isFA ? (
                        <>
                          <span className="text-yellow-700 font-semibold">Add FA</span> <b>{m.in_name}</b> into <b>{m.slot}</b>
                          {m.out_name && !isEmptySlot ? <> (replace <b>{m.out_name}</b>)</> : null}
                          <span className="ml-2 text-green-600">(+{m.gain.toFixed(2)} pts)</span>
                        </>
                      ) : fromIR ? (
                        <>
                          <span className="text-purple-700 dark:text-purple-400 font-semibold">Move from IR</span> <b>{m.in_name}</b> into <b>{m.slot}</b>
                          {m.out_name && !isEmptySlot ? <> (bench <b>{m.out_name}</b>)</> : null}
                          <span className="ml-2 text-green-600">(+{m.gain.toFixed(2)} pts)</span>
                        </>
                      ) : (
                        <>
                          Put <b>{m.in_name}</b> into <b>{m.slot}</b>
                          {m.out_name && !isEmptySlot ? <> (bench <b>{m.out_name}</b>)</> : null}
                          <span className="ml-2 text-green-600">(+{m.gain.toFixed(2)} pts)</span>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Head-to-Head Matchup Section */}
          {lg.opponent && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="font-semibold mb-2 text-blue-800 dark:text-blue-200">This Week's Matchup</div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">{lg.rosterUserDisplay}</div>
                  <div className="text-xs text-gray-500">Your Optimal</div>
                  <div className="font-bold text-lg">{lg.optimalTotal.toFixed(1)}</div>
                </div>
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">{lg.opponent.teamName}</div>
                  <div className="text-xs text-gray-500">Opponent</div>
                  <div className="font-bold text-lg">{lg.opponent.currentTotal.toFixed(1)}</div>
                </div>
              </div>
              <div className="mt-2 text-center">
                {(lg.projectedWin !== undefined || (lg.opponent && lg.pointDifferential === 0)) && (
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
                )}
                {lg.winProbability !== undefined && (
                  <div className="mt-1 text-sm font-medium text-gray-700 dark:text-gray-300" data-testid={`text-win-probability-${lg.league_id}`}>
                    Win Probability: <span className={`font-bold ${
                      lg.winProbability >= 70 ? 'text-green-600 dark:text-green-400' :
                      lg.winProbability >= 30 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-red-600 dark:text-red-400'
                    }`}>{lg.winProbability}%</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-3 text-sm" data-testid={`text-totals-${lg.league_id}`}>
            Current total: <b>{lg.currentTotal.toFixed(2)}</b> — Optimal total: <b>{lg.optimalTotal.toFixed(2)}</b>
          </div>

          <div className="mt-1 text-xs text-gray-600" data-testid={`text-bench-details-${lg.league_id}`}>
            Bench: {lg.benchCount ?? 0}/{lg.benchCapacity ?? 0}
            {(lg.benchEmpty ?? 0) > 0 && <> — <span className="text-amber-700">{lg.benchEmpty} empty</span></>}
          </div>

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
              <div className="mt-4">
                <div className="font-semibold mb-1">Waiver Watchlist</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  Other highly projected free agents to consider
                </div>
                <ul className="space-y-1">
                  {otherFAs.map((fa, i) => (
                    <li key={i} className="text-sm" data-testid={`row-waiver-${i}`}>
                      <b>{fa.name}</b> ({fa.pos}) — <span className="text-green-600 font-medium">{fa.proj?.toFixed(2)} pts</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
