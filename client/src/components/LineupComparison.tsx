import { useState } from "react";
import type { LeagueSummary, RosterSlot, PlayerLite } from "../lib/types";
import { statusFlags } from "../lib/optimizer";
import { StarterBadge } from "./StarterBadge";
import { AutoSubChip } from "./ui/auto-sub-chip";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X } from "lucide-react";
import { InfoTooltip } from "./InfoTooltip";

interface LineupComparisonProps {
  lg: LeagueSummary;
}

const POSITION_COLORS: Record<string, string> = {
  QB: "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700",
  RB: "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700",
  WR: "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700",
  TE: "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700",
  FLEX: "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600",
  SUPER_FLEX: "bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700",
  K: "bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700",
  DEF: "bg-amber-100 dark:bg-amber-900/30 border-amber-400 dark:border-amber-700",
};

function getPositionColor(slot: string): string {
  return POSITION_COLORS[slot] || "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600";
}

function PlayerRow({
  slot,
  player,
  points,
  isOptimal,
  isEmpty,
  autoSubRec,
  requireLaterStart,
  delta,
  isBeingReplaced,
  isBeingAdded,
}: {
  slot: string;
  player?: PlayerLite & { proj?: number; opp?: string; locked?: boolean };
  points: number;
  isOptimal: boolean;
  isEmpty?: boolean;
  autoSubRec?: any;
  requireLaterStart?: boolean;
  delta?: number;
  isBeingReplaced?: boolean;
  isBeingAdded?: boolean;
}) {
  const posColor = getPositionColor(slot);

  return (
    <div
      className={`flex items-center justify-between gap-2 p-3 rounded-lg border ${posColor} transition-colors`}
      data-testid={`row-${isOptimal ? 'optimal' : 'current'}-${slot}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-muted-foreground">{slot}</span>
          {isOptimal && isBeingAdded ? (
            <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
          ) : !isOptimal && isBeingReplaced ? (
            <X className="w-4 h-4 text-red-600 dark:text-red-400" />
          ) : null}
          {delta !== undefined && delta !== 0 && (
            <span 
              className={`text-xs font-semibold ${
                delta > 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}
              data-testid="player-delta"
            >
              ({delta > 0 ? '+' : ''}{delta.toFixed(1)})
            </span>
          )}
        </div>
        
        {isEmpty ? (
          <div className="text-sm italic text-muted-foreground" data-testid="player-empty">Empty slot</div>
        ) : player ? (
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm" data-testid="player-name">{player.name}</span>
              <span className="text-xs text-muted-foreground" data-testid="player-position">({player.pos})</span>
              <StarterBadge p={player} />
            </div>
            <div className="text-sm text-muted-foreground mt-0.5" data-testid="player-points">
              {points.toFixed(1)} pts
            </div>
          </div>
        ) : (
          <div className="text-sm italic text-muted-foreground" data-testid="player-none">—</div>
        )}
      </div>

      {autoSubRec && (
        <AutoSubChip
          recommendation={autoSubRec}
          requireLaterStart={requireLaterStart || false}
        />
      )}
    </div>
  );
}

export function LineupComparison({ lg }: LineupComparisonProps) {
  const [activeTab, setActiveTab] = useState<"current" | "optimal">("current");

  const currentLineup = lg.starters.map((pid, i) => {
    const slot = lg.roster_positions[i];
    const player = lg.starterObjs?.find(p => p.player_id === pid) || lg.allEligible?.find(p => p.player_id === pid);
    const autoSubRec = lg.autoSubRecommendations?.find(rec => rec.starter.player_id === pid);
    const currentPoints = player?.proj ?? 0;
    
    const optimalSlot = lg.optimalSlots[i];
    const optimalPoints = optimalSlot?.player?.proj ?? 0;
    const slotDelta = currentPoints - optimalPoints;
    
    // Only mark as "being replaced" (red X) if there's actually a player in this slot AND it's being replaced by a different player
    const isBeingReplaced = player && optimalSlot?.player && optimalSlot.player.player_id !== pid;
    
    return {
      slot,
      player,
      points: currentPoints,
      isEmpty: !pid || pid === "0" || pid === "",
      autoSubRec,
      delta: slotDelta,
      isBeingReplaced,
    };
  });

  const optimalLineup = lg.optimalSlots.map((s, i) => {
    const currentIds = new Set(lg.starters.filter((x): x is string => !!x));
    const benchIds = new Set(lg.bench.filter(Boolean));
    const isCurrentStarter = s.player ? currentIds.has(s.player.player_id) : false;
    const isBenchPlayer = s.player ? benchIds.has(s.player.player_id) : false;
    const isFreeAgent = s.player && !isCurrentStarter && !isBenchPlayer;
    
    const optimalPoints = s.player?.proj ?? 0;
    const currentSlot = lg.starters[i];
    const currentPlayer = lg.starterObjs?.find(p => p.player_id === currentSlot) || lg.allEligible?.find(p => p.player_id === currentSlot);
    const currentPoints = currentPlayer?.proj ?? 0;
    const slotDelta = optimalPoints - currentPoints;
    
    // Only show green checkmark if this is a NEW addition (bench or FA), NOT already a starter
    const isBeingAdded = s.player && !isCurrentStarter;

    return {
      slot: s.slot,
      player: s.player,
      points: optimalPoints,
      isEmpty: !s.player,
      isFreeAgent,
      isBenchPlayer,
      delta: slotDelta,
      isBeingAdded,
    };
  });

  const delta = lg.optimalTotal - lg.currentTotal;

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">Current Total</div>
          <div className="text-lg font-bold">{lg.currentTotal.toFixed(1)} pts</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground flex items-center justify-center">
            Potential Gain
            <InfoTooltip content="The point difference between your current lineup and the optimal lineup. Positive values indicate how many points you could gain by switching to the optimal lineup." />
          </div>
          <div className={`text-xl font-bold ${
            delta > 0 
              ? 'text-green-600 dark:text-green-400' 
              : delta < 0 
                ? 'text-red-600 dark:text-red-400' 
                : 'text-gray-500'
          }`}>
            {delta > 0 ? '+' : ''}{delta.toFixed(1)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Optimal Total</div>
          <div className="text-lg font-bold text-green-600 dark:text-green-400">{lg.optimalTotal.toFixed(1)} pts</div>
        </div>
      </div>

      {/* Mobile Tabs */}
      <div className="md:hidden">
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab("current")}
            className={`flex-1 py-2 px-4 text-sm font-medium transition-colors relative ${
              activeTab === "current"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="tab-current"
          >
            Current Lineup
            {activeTab === "current" && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab("optimal")}
            className={`flex-1 py-2 px-4 text-sm font-medium transition-colors relative ${
              activeTab === "optimal"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="tab-optimal"
          >
            Optimal Lineup
            {activeTab === "optimal" && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: activeTab === "current" ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: activeTab === "current" ? 20 : -20 }}
            transition={{ duration: 0.2 }}
            className="mt-4 space-y-2"
          >
            {activeTab === "current" ? (
              currentLineup.map((item, i) => (
                <PlayerRow
                  key={i}
                  slot={item.slot}
                  player={item.player}
                  points={item.points}
                  isOptimal={false}
                  isEmpty={item.isEmpty}
                  autoSubRec={item.autoSubRec}
                  requireLaterStart={lg.autoSubConfig?.requireLaterStart}
                  delta={item.delta}
                  isBeingReplaced={item.isBeingReplaced}
                />
              ))
            ) : (
              optimalLineup.map((item, i) => (
                <div key={i} className="relative">
                  <PlayerRow
                    slot={item.slot}
                    player={item.player}
                    points={item.points}
                    isOptimal={true}
                    isEmpty={item.isEmpty}
                    delta={item.delta}
                    isBeingAdded={item.isBeingAdded}
                  />
                  {item.isFreeAgent && (
                    <span className="absolute top-2 right-2 text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" data-testid="badge-free-agent">
                      Free Agent
                    </span>
                  )}
                  {item.isBenchPlayer && (
                    <span className="absolute top-2 right-2 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" data-testid="badge-from-bench">
                      From Bench
                    </span>
                  )}
                </div>
              ))
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Desktop Side-by-Side */}
      <div className="hidden md:grid md:grid-cols-2 md:gap-4">
        <div>
          <h4 className="text-sm font-semibold mb-3 text-muted-foreground flex items-center gap-2">
            <X className="w-4 h-4 text-red-600 dark:text-red-400" />
            Current Lineup
            <span className="text-xs">({lg.currentTotal.toFixed(1)} pts)</span>
          </h4>
          <div className="space-y-2">
            {currentLineup.map((item, i) => (
              <PlayerRow
                key={i}
                slot={item.slot}
                player={item.player}
                points={item.points}
                isOptimal={false}
                isEmpty={item.isEmpty}
                autoSubRec={item.autoSubRec}
                requireLaterStart={lg.autoSubConfig?.requireLaterStart}
                delta={item.delta}
                isBeingReplaced={item.isBeingReplaced}
              />
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-3 text-muted-foreground flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
            Optimal Lineup
            <span className="text-xs">({lg.optimalTotal.toFixed(1)} pts)</span>
          </h4>
          <div className="space-y-2">
            {optimalLineup.map((item, i) => (
              <div key={i} className="relative">
                <PlayerRow
                  slot={item.slot}
                  player={item.player}
                  points={item.points}
                  isOptimal={true}
                  isEmpty={item.isEmpty}
                  delta={item.delta}
                  isBeingAdded={item.isBeingAdded}
                />
                {item.isFreeAgent && (
                  <span className="absolute top-2 right-2 text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" data-testid="badge-free-agent">
                    Free Agent
                  </span>
                )}
                {item.isBenchPlayer && (
                  <span className="absolute top-2 right-2 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" data-testid="badge-from-bench">
                    From Bench
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
