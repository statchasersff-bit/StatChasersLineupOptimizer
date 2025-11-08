import React, { useMemo, useState } from "react";
import type { LeagueSummary } from "../lib/types";
import { statusFlags } from "../lib/optimizer";
import { buildLineupDiff } from "../lib/diff";
import { AutoSubChip } from "./ui/auto-sub-chip";
import { detectGlobalAutoSubSettings, shouldShowAutoSubChip, getAutoSubChipText, getAutoSubChipVariant } from "../lib/autoSubsGlobal";
import { StarterBadge } from "./StarterBadge";
import { motion, AnimatePresence } from "framer-motion";
import { CollapsibleSection } from "./CollapsibleSection";
import { LineupComparison } from "./LineupComparison";
import { UserPlus, Activity, RefreshCw, ArrowRight, Users, TrendingUp, TrendingDown } from "lucide-react";
import { InfoTooltip } from "./InfoTooltip";
import { StatChasersWatermark } from "./StatChasersWatermark";

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

interface LeagueCardProps {
  lg: LeagueSummary;
  globalAutoSubSettings?: ReturnType<typeof detectGlobalAutoSubSettings>;
}

export default function LeagueCard({ lg, globalAutoSubSettings }: LeagueCardProps) {
  const [open, setOpen] = useState(false);

  // TRUE ins/outs based on sets, not slot-by-slot
  const diff = useMemo(() => buildLineupDiff(lg, lg.allEligible, lg.irList), [lg]);
  
  const leagueInitials = getLeagueInitials(lg.name);
  const leagueColor = getLeagueColor(lg.name);

  // Compute auto-sub chip visibility and styling
  const defaultGlobalSettings = { isUniform: false, enabled: false, allowedPerWeek: 0, requireLaterStart: false };
  const effectiveGlobalSettings = globalAutoSubSettings || defaultGlobalSettings;
  const showAutoChip = shouldShowAutoSubChip(lg, effectiveGlobalSettings);
  const autoChipText = getAutoSubChipText(lg);
  const autoChipVariant = getAutoSubChipVariant(lg);

  return (
    <div className="rounded-2xl shadow border" data-testid={`card-league-${lg.league_id}`}>
      
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
          <div className={`text-sm sm:text-base font-semibold animate-fadeUp ${lg.delta >= 0 ? "text-green-600" : "text-red-600"}`} data-testid={`text-delta-${lg.league_id}`}>
            {lg.delta >= 0 ? "+" : ""}{lg.delta.toFixed(1)} pts
          </div>

          {/* Auto-sub chip (only when needed) */}
          {showAutoChip && autoChipText && (
            <span 
              className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full shadow-sm whitespace-nowrap ${
                autoChipVariant === 'warn' 
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' 
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`} 
              data-testid={`badge-auto-sub-${lg.league_id}`}
            >
              {autoChipText}
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
                  <div className="space-y-3 mt-3">
                    {diff.moves.map((m, i) => {
                      // Check if the incoming player is a FA
                      const inPlayer = lg.allEligible?.find(p => p.player_id === m.in_pid);
                      const isFA = (inPlayer as any)?.isFA === true;
                      const fromIR = m.fromIR === true;
                      
                      // Check if out_name is an empty slot (starts with "player_id" or out_pid is "0")
                      const isEmptySlot = !m.out_name || m.out_pid === "0" || m.out_name.startsWith("player_id");
                      
                      return (
                        <motion.div 
                          key={i} 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="relative bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-lg p-4 border border-green-200 dark:border-green-800"
                          data-testid={`card-suggestion-${i}`}
                        >
                          {/* Point Gain Badge - Top Right */}
                          <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: i * 0.05 + 0.2, type: "spring", stiffness: 200 }}
                            className="absolute top-3 right-3 bg-green-500 dark:bg-green-600 text-white px-3 py-1.5 rounded-full font-bold text-sm shadow-lg"
                            data-testid="badge-point-gain"
                          >
                            +{m.gain.toFixed(1)} pts
                          </motion.div>

                          {/* Action Badge */}
                          <div className="mb-2">
                            {isFA ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                <UserPlus className="w-3 h-3" />
                                Add FA
                              </span>
                            ) : fromIR ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                <Activity className="w-3 h-3" />
                                From IR
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                <RefreshCw className="w-3 h-3" />
                                Swap
                              </span>
                            )}
                          </div>

                          {/* Player Swap Visual */}
                          <div className="flex items-center gap-3 pr-24">
                            {!isEmptySlot && m.out_name && (
                              <>
                                <div className="flex-1 text-sm">
                                  <div className="text-muted-foreground text-xs mb-0.5">Out</div>
                                  <div className="font-medium line-through opacity-60">{m.out_name}</div>
                                </div>
                                <ArrowRight className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                              </>
                            )}
                            <div className="flex-1 text-sm">
                              <div className="text-muted-foreground text-xs mb-0.5">In</div>
                              <div className="font-bold text-green-700 dark:text-green-300">{m.in_name}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{m.slot}</div>
                            </div>
                          </div>

                          {/* Action Button */}
                          <button
                            className="mt-3 w-full bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                            data-testid={`button-${isFA ? 'add-fa' : 'swap'}-${i}`}
                          >
                            {isFA ? (
                              <>
                                <UserPlus className="w-4 h-4" />
                                Add Free Agent
                              </>
                            ) : (
                              <>
                                <RefreshCw className="w-4 h-4" />
                                Make Swap
                              </>
                            )}
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                </CollapsibleSection>
              )}

              {/* Matchup Section */}
              {lg.opponent && (
                <CollapsibleSection
                  title="This Week's Matchup"
                  subtitle={`${lg.projectedWin === true ? 'Projected Win' : lg.projectedWin === false ? 'Projected Loss' : 'Projected Tie'}`}
                  defaultOpen={true}
                >
                  <div className="mt-3 space-y-4">
                    {/* Team Avatars and Scores */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-16 h-16 rounded-full bg-blue-500 text-white flex items-center justify-center text-xl font-bold shadow-lg">
                            {lg.rosterUserDisplay?.substring(0, 2).toUpperCase() || 'YO'}
                          </div>
                          <div className="font-bold text-sm">{lg.rosterUserDisplay}</div>
                          <div className="text-xs text-muted-foreground">You (Optimal)</div>
                          <div className="text-2xl font-bold text-foreground animate-fadeUp">{lg.optimalTotal.toFixed(1)}</div>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center text-xl font-bold shadow-lg">
                            {lg.opponent.teamName?.substring(0, 2).toUpperCase() || 'OP'}
                          </div>
                          <div className="font-bold text-sm">{lg.opponent.teamName}</div>
                          <div className="text-xs text-muted-foreground">Opponent</div>
                          <div className="text-2xl font-bold text-foreground animate-fadeUp">{lg.opponent.currentTotal.toFixed(1)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Win Probability Bar */}
                    {lg.winProbability !== undefined && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs font-semibold mb-1">
                          <span className="flex items-center gap-1">
                            Win Probability
                            <InfoTooltip content="Calculated using a normal distribution with ~30 points standard deviation per team. Based on your optimal lineup vs opponent's current lineup point differential." />
                          </span>
                        </div>
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-blue-600 dark:text-blue-400">{lg.winProbability}%</span>
                          <span className="text-red-600 dark:text-red-400">{100 - lg.winProbability}%</span>
                        </div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                            style={{ width: `${lg.winProbability}%` }}
                          />
                          <div 
                            className="bg-gradient-to-r from-red-500 to-red-600"
                            style={{ width: `${100 - lg.winProbability}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Status Card with Microcopy */}
                    {(lg.projectedWin !== undefined || (lg.opponent && lg.pointDifferential === 0)) && (
                      <div className={`py-3 px-4 rounded-lg ${
                        lg.projectedWin === true ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800' : 
                        lg.projectedWin === false ? 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800' : 
                        'bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800'
                      }`}>
                        <div className="flex items-center justify-center gap-2 mb-2">
                          {lg.projectedWin === true ? (
                            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                          ) : lg.projectedWin === false ? (
                            <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
                          ) : (
                            <Users className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                          )}
                          <div className={`font-bold text-lg ${
                            lg.projectedWin === true ? 'text-green-600 dark:text-green-400' : 
                            lg.projectedWin === false ? 'text-red-600 dark:text-red-400' : 
                            'text-yellow-600 dark:text-yellow-400'
                          }`} data-testid={`text-projection-${lg.league_id}`}>
                            {lg.projectedWin === true ? 'Projected Win' : 
                             lg.projectedWin === false ? 'Projected Loss' : 
                             'Projected Tie'}
                          </div>
                        </div>
                        
                        {/* Microcopy */}
                        <div className="text-sm text-center animate-fadeUp">
                          {lg.projectedWin === true && lg.pointDifferential !== undefined && (
                            <p className="text-muted-foreground">
                              Leading by <span className="font-semibold text-green-600 dark:text-green-400">{Math.abs(lg.pointDifferential).toFixed(1)} pts</span> — maintain optimal lineup to secure the win
                            </p>
                          )}
                          {lg.projectedWin === false && lg.pointDifferential !== undefined && (
                            <p className="text-muted-foreground">
                              Trailing by <span className="font-semibold text-red-600 dark:text-red-400">{Math.abs(lg.pointDifferential).toFixed(1)} pts</span> — need {Math.ceil(Math.abs(lg.pointDifferential) / 5)} player{Math.ceil(Math.abs(lg.pointDifferential) / 5) !== 1 ? 's' : ''} to outperform projections
                            </p>
                          )}
                          {lg.projectedWin === undefined && lg.pointDifferential === 0 && (
                            <p className="text-muted-foreground">
                              Dead even — every point matters!
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground text-center border-t border-border pt-2">
                      Bench: {lg.benchCount ?? 0}/{lg.benchCapacity ?? 0}
                      {(lg.benchEmpty ?? 0) > 0 && <> • <span className="text-amber-600">{lg.benchEmpty} empty</span></>}
                    </div>
                    
                    {/* StatChasers Watermark */}
                    <StatChasersWatermark />
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
                    title="Top Free Agents"
                    subtitle="By projected points (scroll to view all)"
                    defaultOpen={false}
                  >
                    <div className="mt-3">
                      {/* Horizontal Scrollable Card List */}
                      <div className="overflow-x-auto pb-2">
                        <div className="flex gap-3 min-w-max">
                          {otherFAs.map((fa, i) => {
                            const projection = fa.proj ?? 0;
                            const isStrongAdd = projection >= 15;
                            const isNeutralAdd = projection >= 10 && projection < 15;
                            
                            return (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.05 }}
                                className="flex-shrink-0 w-40 bg-white dark:bg-gray-800 rounded-lg border border-border p-3 shadow-sm hover:shadow-md transition-all"
                                data-testid={`card-waiver-${i}`}
                              >
                                {/* Position Badge */}
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                    {fa.pos}
                                  </span>
                                  {isStrongAdd && (
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                      Strong
                                    </span>
                                  )}
                                  {isNeutralAdd && (
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                                      Neutral
                                    </span>
                                  )}
                                </div>

                                {/* Player Name */}
                                <div className="font-bold text-sm mb-2 line-clamp-2" title={fa.name}>
                                  {fa.name}
                                </div>

                                {/* Projected Points */}
                                <div className="flex items-center justify-between mb-3">
                                  <span className="text-xs text-muted-foreground">Proj Pts</span>
                                  <span className={`text-lg font-bold ${
                                    isStrongAdd 
                                      ? 'text-green-600 dark:text-green-400' 
                                      : isNeutralAdd 
                                        ? 'text-yellow-600 dark:text-yellow-400'
                                        : 'text-gray-600 dark:text-gray-400'
                                  }`}>
                                    {projection.toFixed(1)}
                                  </span>
                                </div>

                                {/* Add Button */}
                                <button
                                  className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white text-xs font-semibold py-1.5 px-2 rounded flex items-center justify-center gap-1 transition-colors"
                                  data-testid={`button-add-waiver-${i}`}
                                >
                                  <UserPlus className="w-3 h-3" />
                                  Add
                                </button>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
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
