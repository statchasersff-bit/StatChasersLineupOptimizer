import { CheckCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface OptActCellProps {
  optPoints: number;
  actPoints: number;
}

export function OptActCell({ optPoints, actPoints }: OptActCellProps) {
  const delta = (optPoints ?? 0) - (actPoints ?? 0);
  const EPS = 0.05;

  if (Math.abs(delta) < EPS) {
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
