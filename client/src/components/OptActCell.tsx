import { CheckCircle, Lock } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface OptActCellProps {
  optPoints: number;
  actPoints: number;
  fullOptimalPoints?: number; // Full optimal ignoring locks (for comparison)
  hasLockedPlayers?: boolean; // Whether any players are locked
}

export function OptActCell({ optPoints, actPoints, fullOptimalPoints, hasLockedPlayers }: OptActCellProps) {
  const delta = (optPoints ?? 0) - (actPoints ?? 0);
  const fullDelta = fullOptimalPoints !== undefined ? (fullOptimalPoints - (actPoints ?? 0)) : delta;
  const EPS = 0.05;
  
  // Helper to format delta with proper sign
  const formatDelta = (value: number) => {
    if (Math.abs(value) < EPS) return '0.0';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}`;
  };

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
