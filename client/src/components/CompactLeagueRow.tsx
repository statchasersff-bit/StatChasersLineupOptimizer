import { ChevronDown } from "lucide-react";

interface CompactLeagueRowProps {
  leagueName: string;
  formatText: string;
  myRecord: string;
  myProj: number;
  oppProj: number;
  oppName: string;
  oppAvatar?: string;
  locked?: boolean;
  winPct: number;
  deltaOptAct?: number;
  projResult?: number;
  quesCount?: number;
  outByeEmptyCount?: number;
  onClick?: () => void;
  isExpanded?: boolean;
  username?: string;
}

export function CompactLeagueRow({
  leagueName,
  formatText,
  myRecord,
  myProj,
  oppProj,
  oppName,
  oppAvatar,
  locked,
  winPct,
  deltaOptAct = 0,
  projResult = 0,
  quesCount,
  outByeEmptyCount,
  onClick,
  isExpanded = false,
  username,
}: CompactLeagueRowProps) {
  // Defensive checks for undefined/null values
  const safeMyProj = typeof myProj === 'number' && isFinite(myProj) ? myProj : 0;
  const safeOppProj = typeof oppProj === 'number' && isFinite(oppProj) ? oppProj : 0;
  const safeWinPct = typeof winPct === 'number' && isFinite(winPct) ? winPct : 0;
  const safeDeltaOptAct = typeof deltaOptAct === 'number' && isFinite(deltaOptAct) ? deltaOptAct : 0;
  const safeProjResult = typeof projResult === 'number' && isFinite(projResult) ? projResult : 0;
  
  const pct = Math.round(safeWinPct * 100);
  const resIsPos = safeProjResult >= 0;
  const deltaIsPos = safeDeltaOptAct >= 0;

  // Extract format tag like [REDRAFT] from the league name
  const formatTagMatch = leagueName.match(/\[(.*?)\]$/);
  const formatTag = formatTagMatch ? formatTagMatch[1] : null;
  
  // Clean league name (remove format tag)
  const displayName = leagueName.replace(/\s*\[(.*?)\]\s*$/g, '').trim();

  // Get initials for avatar
  const getInitials = () => {
    const words = displayName.split(' ').filter(w => w.length > 0);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return displayName.substring(0, 2).toUpperCase();
  };

  const getAvatarUrl = () => {
    if (oppAvatar) return oppAvatar;
    
    // Get a safe ASCII initial for the avatar
    const getSafeInitial = (name: string): string => {
      if (!name || name.trim().length === 0) return '?';
      const firstChar = name.charAt(0).toUpperCase();
      // Only use ASCII letters A-Z, otherwise use first letter or ?
      return /^[A-Z]$/i.test(firstChar) ? firstChar : (firstChar || '?');
    };
    
    // Simple SVG data URL using URL encoding (no btoa needed)
    const createSvgDataUrl = (initial: string, fillColor: string, textColor: string) => {
      // Escape the initial character for XML safety
      const escapedInitial = initial
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
        
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26"><circle cx="13" cy="13" r="13" fill="${fillColor}"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="${textColor}" font-family="sans-serif" font-size="13" font-weight="bold">${escapedInitial}</text></svg>`;
      
      // Use simple URL encoding - works for all characters
      return `data:image/svg+xml,${svg.replace(/#/g, '%23')}`;
    };
    
    const initial = getSafeInitial(oppName);
    return createSvgDataUrl(initial, '#0A2342', '#FFB703');
  };

  return (
    <button 
      className={`match-row ${isExpanded ? 'match-row-expanded' : ''}`}
      aria-label={`${leagueName}, ${formatText}, win ${pct}%`}
      onClick={onClick}
      data-testid={`compact-row-${leagueName.replace(/\s/g, '-').toLowerCase()}`}
    >
      <div className="flex flex-col gap-3 w-full">
        {/* Header Row */}
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-sm">
            {getInitials()}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm truncate" title={leagueName}>
              {displayName}
            </div>
            <div className="flex items-center gap-2 flex-wrap text-xs mt-1">
              {formatTag && <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground">{formatTag}</span>}
              {username && <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground">{username.toUpperCase()}</span>}
              {formatText && <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground">{formatText}</span>}
              {myRecord && <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground">{myRecord}</span>}
            </div>
          </div>

          <ChevronDown className={`w-5 h-5 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </div>

        {/* Scores + Win Bar */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-sm font-semibold">
            {locked && <span aria-label="Lineup locked">🔒</span>}
            <span>{safeMyProj.toFixed(1)}</span>
          </div>

          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden relative">
              <div 
                className={`h-full transition-all ${
                  pct >= 61 ? 'bg-gradient-to-r from-green-500 to-green-600' :
                  pct >= 40 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                  'bg-gradient-to-r from-red-400 to-red-600'
                }`}
                style={{width: `${pct}%`}} 
              />
              <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white mix-blend-difference">
                {pct}%
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-sm font-semibold">
            <span>{safeOppProj.toFixed(1)}</span>
            <img className="w-6 h-6 rounded-full" src={getAvatarUrl()} alt={oppName || 'Opponent'} />
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-muted-foreground">Δ</span>
          <span className={`px-2 py-0.5 rounded font-semibold ${deltaIsPos ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
            {deltaIsPos ? '+' : ''}{safeDeltaOptAct.toFixed(1)} pts
          </span>
          <span className="text-muted-foreground">MRGN</span>
          <span className={`px-2 py-0.5 rounded font-semibold ${resIsPos ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
            {resIsPos ? '+' : ''}{safeProjResult.toFixed(1)}
          </span>
          {typeof quesCount === 'number' && quesCount > 0 && (
            <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 font-semibold">
              ⚠️ {quesCount}
            </span>
          )}
          {typeof outByeEmptyCount === 'number' && outByeEmptyCount > 0 && (
            <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-semibold">
              ❌ {outByeEmptyCount}
            </span>
          )}
          {typeof outByeEmptyCount === 'number' && outByeEmptyCount === 0 && (
            <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-semibold">
              ✓ 0
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
