import { CheckCircle, Lock, AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMemo } from "react";

export type RowState = 'EMPTY' | 'BENCH' | 'WAIVER' | 'OPTIMAL' | 'UNKNOWN';

interface OptActCellProps {
  // New three-tier props (prioritized if provided)
  rowState?: RowState;
  deltaBench?: number;
  deltaWaiver?: number;
  deltaTotal?: number;
  freeAgentsEnabled?: boolean;
  pickupsLeft?: number;
  lockedCount?: number;
  
  // Legacy props (fallback for backward compatibility)
  optPoints?: number;
  actPoints?: number;
  fullOptimalPoints?: number;
  hasLockedPlayers?: boolean;
}

export function OptActCell({ 
  rowState,
  deltaBench,
  deltaWaiver,
  deltaTotal,
  freeAgentsEnabled,
  pickupsLeft,
  lockedCount,
  // Legacy
  optPoints,
  actPoints,
  fullOptimalPoints,
  hasLockedPlayers
}: OptActCellProps) {
  const EPS = 0.05;
  const THRESH = 1.5;
  
  // Helper to format delta with proper sign
  const formatDelta = (value: number) => {
    if (!Number.isFinite(value) || Math.abs(value) < EPS) return '0.0';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}`;
  };
  
  // Use new rowState if provided, otherwise fall back to legacy mode
  const useNewStateSystem = rowState !== undefined;
  
  // Memoized state descriptor for consistent rendering
  const stateDescriptor = useMemo(() => {
    if (!useNewStateSystem) return null;
    
    switch (rowState) {
      case 'EMPTY':
        return {
          badge: {
            bg: 'bg-red-100 dark:bg-red-900/30',
            text: 'text-red-700 dark:text-red-400',
            icon: AlertTriangle,
            label: 'Fill empty slots',
            testId: 'state-empty'
          },
          tooltip: 'You have empty starting lineup slots that need to be filled'
        };
        
      case 'BENCH':
        return {
          badge: {
            bg: 'bg-yellow-100 dark:bg-yellow-900/30',
            text: 'text-yellow-700 dark:text-yellow-400',
            icon: null,
            label: `Bench Δ ${formatDelta(deltaBench ?? 0)}`,
            testId: 'state-bench'
          },
          tooltip: 'You can improve your lineup by promoting bench players'
        };
        
      case 'WAIVER':
        return {
          badge: {
            bg: 'bg-blue-100 dark:bg-blue-900/30',
            text: 'text-blue-700 dark:text-blue-400',
            icon: null,
            label: null, // Will render two chips
            testId: 'state-waiver'
          },
          tooltip: 'Further improvements available through free agent pickups',
          showBothDeltas: true
        };
        
      case 'OPTIMAL':
        return {
          badge: {
            bg: 'text-green-600',
            text: 'text-green-600',
            icon: CheckCircle,
            label: null,
            testId: 'state-optimal'
          },
          tooltip: 'Lineup is already optimal'
        };
        
      case 'UNKNOWN':
      default:
        return {
          badge: {
            bg: 'bg-gray-100 dark:bg-gray-800',
            text: 'text-gray-700 dark:text-gray-300',
            icon: AlertTriangle,
            label: 'Error',
            testId: 'state-unknown'
          },
          tooltip: 'Error calculating lineup metrics'
        };
    }
  }, [rowState, deltaBench, deltaWaiver, useNewStateSystem]);
  
  // New state system rendering
  if (useNewStateSystem && stateDescriptor) {
    const { badge, tooltip, showBothDeltas } = stateDescriptor;
    
    // OPTIMAL state - green checkmark
    if (rowState === 'OPTIMAL') {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 text-green-600" data-testid={badge.testId}>
              <CheckCircle className="h-4 w-4" aria-hidden />
              {lockedCount && lockedCount > 0 && (
                <Lock className="h-3 w-3 text-muted-foreground" aria-hidden />
              )}
              <span className="sr-only">{tooltip}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs">
              <div>{tooltip}</div>
              {lockedCount && lockedCount > 0 && (
                <div className="text-muted-foreground mt-1">
                  {lockedCount} locked player{lockedCount > 1 ? 's' : ''}
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      );
    }
    
    // WAIVER state - show both deltas
    if (showBothDeltas) {
      const waiverDisabled = !freeAgentsEnabled || (pickupsLeft ?? 0) === 0;
      const showWaiverChip = Number.isFinite(deltaWaiver) && (deltaWaiver ?? 0) >= THRESH;
      
      return (
        <div className="inline-flex items-center gap-1.5 flex-wrap" data-testid={badge.testId}>
          {/* Bench delta chip */}
          {Number.isFinite(deltaBench) && (deltaBench ?? 0) >= EPS && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
              Bench Δ {formatDelta(deltaBench ?? 0)}
            </span>
          )}
          
          {/* Waiver delta chip (grayed if disabled) */}
          {showWaiverChip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span 
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    waiverDisabled
                      ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500 opacity-60'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  }`}
                >
                  Waiver Δ {formatDelta(deltaWaiver ?? 0)}
                  {waiverDisabled && <span className="text-[10px] ml-0.5">(off)</span>}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  {waiverDisabled 
                    ? 'Free agents toggle is off or no pickups remaining'
                    : 'Additional improvement available through free agent pickups'
                  }
                </div>
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* Lock indicator */}
          {lockedCount && lockedCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Lock className="h-3 w-3 text-muted-foreground" aria-hidden />
              </TooltipTrigger>
              <TooltipContent>
                {lockedCount} locked player{lockedCount > 1 ? 's' : ''}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      );
    }
    
    // Other states - single badge
    const Icon = badge.icon;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span 
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}
            data-testid={badge.testId}
          >
            {Icon && <Icon className="h-4 w-4" aria-hidden />}
            {badge.label}
            {lockedCount && lockedCount > 0 && (
              <Lock className="h-3 w-3 ml-0.5 opacity-60" aria-hidden />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">
            <div>{tooltip}</div>
            {lockedCount && lockedCount > 0 && (
              <div className="text-muted-foreground mt-1">
                {lockedCount} locked player{lockedCount > 1 ? 's' : ''}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }
  
  // ===== LEGACY MODE (backward compatibility) =====
  const delta = (optPoints ?? 0) - (actPoints ?? 0);
  const fullDelta = fullOptimalPoints !== undefined ? (fullOptimalPoints - (actPoints ?? 0)) : delta;

  // Check if lineup is already at reachable optimal
  if (Math.abs(delta) < EPS) {
    // If there are locked players, show that optimal was reached despite locks
    if (hasLockedPlayers && Math.abs(fullDelta - delta) > EPS) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 text-green-600" data-testid="optimal-checkmark">
              <CheckCircle className="h-4 w-4" aria-hidden />
              <Lock className="h-3 w-3 text-muted-foreground" aria-hidden />
              <span className="sr-only">Optimal (with locked players)</span>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs">
              <div>Optimal lineup achieved</div>
              <div className="text-muted-foreground mt-1">
                Full optimal (no locks): {formatDelta(fullDelta)} pts
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      );
    }
    
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 text-green-600" data-testid="optimal-checkmark">
            <CheckCircle className="h-4 w-4" aria-hidden />
            <span className="sr-only">Already optimal</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Already optimal
        </TooltipContent>
      </Tooltip>
    );
  }

  const sign = delta > 0 ? "+" : "";
  const ArrowIcon = delta > 0 ? (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd"/>
    </svg>
  ) : (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path fillRule="evenodd" d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd"/>
    </svg>
  );

  // Show reachable delta as main metric, with full delta in tooltip if locks exist
  if (hasLockedPlayers && Math.abs(fullDelta - delta) > EPS) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span 
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
              delta > 0 
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}
            data-testid="opt-act-delta"
          >
            {ArrowIcon}
            {sign}{delta.toFixed(1)}
            <Lock className="h-3 w-3 ml-0.5 opacity-60" aria-hidden />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-1">
            <div>
              <strong>Reachable:</strong> {formatDelta(delta)} pts
            </div>
            <div className="text-muted-foreground">
              (Some players already played)
            </div>
            <div className="pt-1 border-t">
              <strong>Full optimal:</strong> {formatDelta(fullDelta)} pts
            </div>
            <div className="text-muted-foreground text-[10px]">
              (If no locks existed)
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <span 
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
        delta > 0 
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      }`}
      data-testid="opt-act-delta"
    >
      {ArrowIcon}
      {sign}{delta.toFixed(1)}
    </span>
  );
}
