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
  const EPS = 0.05; // treat |delta| < 0.05 as 0

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

  const sign = delta > 0 ? "+" : ""; // keep minus automatically
  const cls = delta > 0 ? "text-green-600" : "text-red-600";
  return (
    <span className={cls} data-testid="opt-act-delta">
      {sign}{delta.toFixed(1)}
    </span>
  );
}
