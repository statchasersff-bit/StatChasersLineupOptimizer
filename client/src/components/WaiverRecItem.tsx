import type { DiffWaiverRecommendation } from "@/lib/waivers";

interface WaiverRecItemProps {
  rec: DiffWaiverRecommendation;
  leagueId: string;
  variant?: 'compact' | 'expanded';
}

export function WaiverRecItem({ rec, leagueId, variant = 'compact' }: WaiverRecItemProps) {
  const slotName = rec.added.slot === 'SUPER_FLEX' ? 'SF' : rec.added.slot;
  const isEmptyFill = rec.removed.length === 0;
  
  return (
    <li 
      className="rounded-md border p-2 text-xs"
      data-testid={`waiver-suggestion-${leagueId}-${rec.added.player_id}`}
    >
      <div className="space-y-0.5">
        {/* Primary line: Add X → slot (+delta) */}
        <div className="font-medium text-green-700">
          ➕ Add {rec.added.name} ({rec.added.pos}) → {slotName} +{rec.deltaTotal.toFixed(1)}
        </div>
        
        {/* Secondary line: Benches Y or Fills EMPTY */}
        <div className="text-muted-foreground">
          {isEmptyFill ? (
            `Fills EMPTY ${slotName}`
          ) : (
            `Benches ${rec.removed[0].name}${rec.removed.length > 1 ? ` +${rec.removed.length - 1} more` : ''}`
          )}
        </div>
        
        {/* Cascade moves (only in expanded variant) */}
        {rec.moved.length > 0 && variant === 'expanded' && (
          <div className="text-xs text-blue-600 mt-1">
            ↔️ {rec.moved.length} cascade move{rec.moved.length > 1 ? 's' : ''}
          </div>
        )}
      </div>
      
      {/* Sleeper link */}
      <a
        className="text-primary hover:underline text-xs mt-1 inline-block"
        href={`https://sleeper.com/leagues/${leagueId}/players/${rec.added.player_id}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        View on Sleeper →
      </a>
    </li>
  );
}
