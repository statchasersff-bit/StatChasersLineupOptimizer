import React, { useMemo, useState, useCallback } from "react";
import type { LeagueSummary, WaiverSuggestion } from "../lib/types";
import { statusFlags } from "../lib/optimizer";
import { buildLineupDiff } from "../lib/diff";
import { AutoSubChip } from "./ui/auto-sub-chip";
import { detectGlobalAutoSubSettings, shouldShowAutoSubChip, getAutoSubChipText, getAutoSubChipVariant } from "../lib/autoSubsGlobal";
import { StarterBadge } from "./StarterBadge";
import { motion, AnimatePresence } from "framer-motion";
import { CollapsibleSection } from "./CollapsibleSection";
import { LineupComparison } from "./LineupComparison";
import { Activity, ArrowRight, Users, TrendingUp, TrendingDown, UserPlus, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
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

// Determine left border color based on status
// QUES players are informational only and should NOT affect optimal status
function getStatusBorderColor(lg: LeagueSummary): string {
  const outCount = lg.outByeEmptyCount ?? 0;
  const delta = lg.achievableDelta ?? lg.delta;
  
  if (outCount > 0) return 'border-l-red-500';
  if (delta <= 0.1) return 'border-l-green-500';
  return 'border-l-blue-500';
}

// Determine background color based on status
// QUES players are informational only and should NOT affect optimal status
function getStatusBackground(lg: LeagueSummary): string {
  const outCount = lg.outByeEmptyCount ?? 0;
  const delta = lg.achievableDelta ?? lg.delta;
  
  if (outCount > 0) return 'bg-red-50/50 dark:bg-red-950/10';
  if (delta <= 0.1) return 'bg-green-50/50 dark:bg-green-950/10';
  return 'bg-card';
}

// Micro win probability bar component
function MicroWinBar({ probability }: { probability: number }) {
  const bars = 5;
  const filledBars = Math.round((probability / 100) * bars);
  
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="text-[10px] sm:text-xs text-muted-foreground">{probability}%</span>
      <span className="flex gap-px ml-0.5">
        {Array.from({ length: bars }).map((_, i) => (
          <span
            key={i}
            className={`w-1 h-2.5 rounded-sm ${
              i < filledBars
                ? probability >= 60 ? 'bg-green-500' : probability >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                : 'bg-gray-300 dark:bg-gray-600'
            }`}
          />
        ))}
      </span>
    </span>
  );
}

interface LeagueCardProps {
  lg: LeagueSummary;
  globalAutoSubSettings?: ReturnType<typeof detectGlobalAutoSubSettings>;
}

export default function LeagueCard({ lg, globalAutoSubSettings }: LeagueCardProps) {
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'changes' | 'lineup' | 'waivers' | null>('changes');

  // TRUE ins/outs based on sets, not slot-by-slot
  const diff = useMemo(() => buildLineupDiff(lg, lg.allEligible, lg.irList), [lg]);
  
  const leagueInitials = getLeagueInitials(lg.name);
  const leagueColor = getLeagueColor(lg.name);
  const borderColor = getStatusBorderColor(lg);
  const bgColor = getStatusBackground(lg);

  // Compute auto-sub chip visibility and styling
  const defaultGlobalSettings = { isUniform: false, enabled: false, allowedPerWeek: 0, requireLaterStart: false };
  const effectiveGlobalSettings = globalAutoSubSettings || defaultGlobalSettings;
  const showAutoChip = shouldShowAutoSubChip(lg, effectiveGlobalSettings);
  const autoChipText = getAutoSubChipText(lg);
  const autoChipVariant = getAutoSubChipVariant(lg);

  // Calculate counts
  const outCount = lg.outByeEmptyCount ?? 0;
  const quesCount = lg.quesCount ?? 0;
  const delta = lg.achievableDelta ?? lg.delta;
  const changesCount = diff.enrichedMoves?.length ?? diff.moves?.length ?? 0;
  const waiversCount = lg.waiverSuggestions?.length ?? 0;

  // Toggle accordion section
  const toggleSection = useCallback((section: 'changes' | 'lineup' | 'waivers') => {
    setActiveSection(prev => prev === section ? null : section);
  }, []);

  return (
    <div 
      className={`rounded-xl shadow-sm border border-l-4 ${borderColor} ${bgColor} overflow-hidden`}
      data-testid={`card-league-${lg.league_id}`}
    >
      {/* Compact Header - 2 Row Layout */}
      <div
        role="button"
        tabIndex={0}
        className="w-full px-3 py-2.5 sm:px-4 sm:py-3 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        aria-expanded={open}
        data-testid={`button-toggle-${lg.league_id}`}
      >
        {/* Row 1: Avatar, Name, Delta, Status Icons */}
        <div className="flex items-start gap-1.5 sm:gap-3">
          {/* League Avatar - Smaller on mobile */}
          <div 
            className={`flex-shrink-0 w-7 h-7 sm:w-10 sm:h-10 rounded-full ${leagueColor} flex items-center justify-center font-bold text-[10px] sm:text-sm shadow mt-0.5`}
            data-testid={`avatar-${lg.league_id}`}
          >
            {leagueInitials}
          </div>

          {/* League Name - 2 lines on mobile, single on desktop */}
          <div className="flex-1 min-w-0">
            <h3 
              className="text-[13px] sm:text-base font-semibold leading-tight line-clamp-2 sm:truncate sm:line-clamp-none" 
              data-testid={`text-league-name-${lg.league_id}`}
              title={lg.name}
            >
              {lg.name}
            </h3>
          </div>

          {/* Delta Badge */}
          <div 
            className={`flex-shrink-0 text-xs sm:text-sm font-bold px-2 py-0.5 rounded-full ${
              delta >= 0.1 
                ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' 
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
            data-testid={`text-delta-${lg.league_id}`}
          >
            {delta >= 0 ? "+" : ""}{delta.toFixed(1)}
          </div>

          {/* Compact Status Icons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {outCount > 0 && (
              <span className="text-xs font-semibold flex items-center gap-0.5" data-testid={`badge-out-${lg.league_id}`}>
                <span>🔴</span>
                <span className="text-red-600 dark:text-red-400">{outCount}</span>
              </span>
            )}
            {quesCount > 0 && (
              <span className="text-xs font-semibold flex items-center gap-0.5" data-testid={`badge-ques-${lg.league_id}`}>
                <span>🟡</span>
                <span className="text-yellow-600 dark:text-yellow-400">{quesCount}</span>
              </span>
            )}
            {outCount === 0 && delta <= 0.1 && (
              <span className="text-xs">✅</span>
            )}
          </div>

          {/* Chevron */}
          <ChevronDown 
            className={`w-4 h-4 text-muted-foreground transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
          />
        </div>

        {/* Row 2: Meta info - tiny text */}
        <div className="flex items-center gap-2 mt-1 ml-[34px] sm:ml-[52px] text-[10px] sm:text-xs text-muted-foreground flex-wrap">
          {/* Auto-subs indicator */}
          {showAutoChip && autoChipText && (
            <span className={`flex items-center gap-0.5 ${autoChipVariant === 'warn' ? 'text-red-500' : ''}`}>
              <span>🔧</span>
              <span>{autoChipText}</span>
            </span>
          )}
          
          {/* Win probability with micro bar */}
          {lg.winProbability !== undefined && (
            <span className="flex items-center gap-1">
              <MicroWinBar probability={lg.winProbability} />
              <span className="hidden sm:inline">win</span>
            </span>
          )}

          {/* Opponent */}
          {lg.opponent && (
            <span className="hidden sm:inline">
              vs {lg.opponent.teamName.slice(0, 12)}{lg.opponent.teamName.length > 12 ? '...' : ''}
            </span>
          )}

          {/* Changes count */}
          {changesCount > 0 && (
            <span className="text-green-600 dark:text-green-400">
              {changesCount} change{changesCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Expanded Content - Accordion Style */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-3 pb-3 sm:px-4 sm:pb-4 space-y-2">
              {/* Accordion Section Headers */}
              <div className="flex flex-wrap gap-1.5 border-b border-border pb-2">
                <button
                  type="button"
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                    activeSection === 'changes' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                  }`}
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    e.preventDefault();
                    toggleSection('changes'); 
                  }}
                  data-testid={`tab-changes-${lg.league_id}`}
                >
                  Changes {changesCount > 0 && `(${changesCount})`}
                </button>
                <button
                  type="button"
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                    activeSection === 'lineup' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                  }`}
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    e.preventDefault();
                    toggleSection('lineup'); 
                  }}
                  data-testid={`tab-lineup-${lg.league_id}`}
                >
                  Lineup
                </button>
                <button
                  type="button"
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                    activeSection === 'waivers' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                  }`}
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    e.preventDefault();
                    toggleSection('waivers'); 
                  }}
                  data-testid={`tab-waivers-${lg.league_id}`}
                >
                  Waivers {waiversCount > 0 && `(${waiversCount})`}
                </button>
              </div>

              {/* Active Section Content */}
              <AnimatePresence mode="wait">
                {activeSection === 'changes' && (
                  <motion.div
                    key="changes"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                  >
                    {/* Suggested Changes Section - Compact */}
                    {(diff.enrichedMoves && diff.enrichedMoves.length > 0) ? (
                      <div className="space-y-2">
                        {diff.enrichedMoves.map((rec, i) => {
                          const isFA = rec.source === 'FA';
                          const fromIR = rec.source === 'IR';
                          
                          return (
                            <div 
                              key={i} 
                              className="relative bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-lg p-2.5 sm:p-3 border border-green-200 dark:border-green-800"
                              data-testid={`card-suggestion-${i}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  {/* Action badges inline */}
                                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                    {isFA && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                        <UserPlus className="w-2.5 h-2.5" />
                                        FA
                                      </span>
                                    )}
                                    {fromIR && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                        <Activity className="w-2.5 h-2.5" />
                                        IR
                                      </span>
                                    )}
                                    {rec.isFillingEmpty && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                                        EMPTY
                                      </span>
                                    )}
                                  </div>
                                  
                                  {/* Main action */}
                                  <div className="text-xs sm:text-sm font-semibold text-green-700 dark:text-green-300">
                                    {rec.title} → {rec.slot}
                                  </div>
                                  
                                  {/* Secondary info */}
                                  <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                                    {rec.displaced ? (
                                      <span>Benches {rec.displaced.name}</span>
                                    ) : rec.isFillingEmpty ? (
                                      <span className="text-amber-600 dark:text-amber-400">Fills empty slot</span>
                                    ) : null}
                                  </div>
                                </div>
                                
                                {/* Point gain */}
                                <div className="flex-shrink-0 bg-green-500 dark:bg-green-600 text-white px-2 py-1 rounded-full font-bold text-xs shadow">
                                  +{rec.netDelta.toFixed(1)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : diff.moves.length > 0 ? (
                      <div className="space-y-2">
                        {diff.moves.map((m, i) => {
                          const inPlayer = lg.allEligible?.find(p => p.player_id === m.in_pid);
                          const isFA = (inPlayer as any)?.isFA === true;
                          const fromIR = m.fromIR === true;
                          const isEmptySlot = !m.out_name || m.out_pid === "0" || m.out_name.startsWith("player_id");
                          
                          return (
                            <div 
                              key={i} 
                              className="relative bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-lg p-2.5 sm:p-3 border border-green-200 dark:border-green-800"
                              data-testid={`card-suggestion-${i}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                    {isFA && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                        <UserPlus className="w-2.5 h-2.5" />
                                        FA
                                      </span>
                                    )}
                                    {fromIR && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                        <Activity className="w-2.5 h-2.5" />
                                        IR
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div className="text-xs sm:text-sm font-semibold text-green-700 dark:text-green-300">
                                    Start {m.in_name} → {m.slot}
                                  </div>
                                  
                                  {isEmptySlot ? (
                                    <div className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                                      Fills empty slot
                                    </div>
                                  ) : m.out_name && (
                                    <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                                      Benches {m.out_name}
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex-shrink-0 bg-green-500 dark:bg-green-600 text-white px-2 py-1 rounded-full font-bold text-xs shadow">
                                  +{m.gain.toFixed(1)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : outCount > 0 ? (
                      <div className="text-center py-4 text-xs sm:text-sm text-amber-600 dark:text-amber-400">
                        ⚠️ {outCount} empty/unavailable starter{outCount > 1 ? 's' : ''} - no fix available on roster
                      </div>
                    ) : (
                      <div className="text-center py-4 text-xs sm:text-sm text-green-600 dark:text-green-400">
                        ✅ Lineup is optimal!
                      </div>
                    )}
                  </motion.div>
                )}

                {activeSection === 'lineup' && (
                  <motion.div
                    key="lineup"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                  >
                    <LineupComparison lg={lg} />
                  </motion.div>
                )}

                {activeSection === 'waivers' && (
                  <motion.div
                    key="waivers"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                  >
                    {lg.waiverSuggestions && lg.waiverSuggestions.length > 0 ? (
                      <div className="space-y-2">
                        {lg.waiverSuggestions.slice(0, 5).map((w: WaiverSuggestion, i: number) => (
                          <div 
                            key={i} 
                            className="flex items-center justify-between p-2 bg-muted rounded-lg text-xs sm:text-sm"
                            data-testid={`waiver-${i}`}
                          >
                            <div>
                              <span className="font-medium">{w.name}</span>
                              <span className="text-muted-foreground ml-1">({w.pos})</span>
                            </div>
                            <span className="text-green-600 dark:text-green-400 font-semibold">
                              +{w.gain?.toFixed(1)} pts
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-xs sm:text-sm text-muted-foreground">
                        No significant waiver pickups available
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
