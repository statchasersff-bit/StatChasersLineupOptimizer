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
  const pct = Math.round(winPct * 100);
  const resIsPos = projResult >= 0;
  const deltaIsPos = deltaOptAct >= 0;

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
    // Use base64 encoding instead of encodeURIComponent to avoid "URI malformed" errors
    const createSvgDataUrl = (initial: string, fillColor: string, textColor: string) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26"><circle cx="13" cy="13" r="13" fill="${fillColor}"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="${textColor}" font-family="sans-serif" font-size="13" font-weight="bold">${initial}</text></svg>`;
      return `data:image/svg+xml;base64,${btoa(svg)}`;
    };
    
    // Safety check: handle missing or empty opponent name
    if (!oppName || oppName.trim().length === 0) {
      return createSvgDataUrl('?', '#cccccc', '#666666');
    }
    
    const initial = oppName.charAt(0).toUpperCase();
    return createSvgDataUrl(initial, '#0A2342', '#FFB703');
  };

  return (
    <button 
      className={`match-row ${isExpanded ? 'match-row-expanded' : ''}`}
      aria-label={`${leagueName}, ${formatText}, win ${pct}%`}
      onClick={onClick}
      data-testid={`compact-row-${leagueName.replace(/\s/g, '-').toLowerCase()}`}
    >
      <div className="league-card-header">
        {/* Header: avatar | name | chevron */}
        <div className="card-head">
          <div className="league-avatar">{getInitials()}</div>
          
          <div className="league-name" title={leagueName}>
            {displayName}
          </div>
          
          <ChevronDown className="chevron" />
        </div>

        {/* Chips below name (mobile) / next to name (desktop) */}
        <div className="card-chips">
          {formatTag && <span className="chip-format">{formatTag}</span>}
          {username && <span className="chip-user">{username.toUpperCase()}</span>}
          {formatText && <span className="chip-scoring">{formatText}</span>}
          {myRecord && <span className="chip-record">{myRecord}</span>}
        </div>

        {/* Scores + win bar */}
        <div className="card-barrow">
          <div className="my-score">
            {locked && <span className="m-lock" aria-label="Lineup locked">🔒</span>}
            <span className="m-num">{myProj.toFixed(1)}</span>
          </div>

          <div className="winbar">
            <div className="winfill">
              <div 
                className="m-fill" 
                style={{width: `${pct}%`}} 
              />
            </div>
            <div className="winpct">{pct}%</div>
          </div>

          <div className="opp-score">
            <span className="m-num">{oppProj.toFixed(1)}</span>
            <img className="m-opp" src={getAvatarUrl()} alt={oppName} />
          </div>
        </div>

        {/* Mini strip: Δ · MRGN · chips */}
        <div className="card-meta">
          <span className="k" title="Points gained vs current lineup">Δ</span>
          <span className={`pill ${deltaIsPos ? 'pill-pos' : 'pill-neg'}`} title="Points gained vs current lineup">
            {deltaIsPos ? '+' : ''}{deltaOptAct.toFixed(1)} pts
          </span>
          <span className="k" title="Projected margin vs opponent">MRGN</span>
          <span className={`pill ${resIsPos ? 'pill-pos' : 'pill-neg'}`} title="Projected margin vs opponent">
            {resIsPos ? '+' : ''}{projResult.toFixed(1)}
          </span>
          {typeof quesCount === 'number' && quesCount > 0 && (
            <span className="chip chip-weekcap" title="Questionable starters">
              <span className="dot y"></span>{quesCount}
            </span>
          )}
          {typeof outByeEmptyCount === 'number' && outByeEmptyCount > 0 && (
            <span className="chip chip-empties" title="Out/Bye/Empty starters">
              <span className="dot r"></span>{outByeEmptyCount}
            </span>
          )}
          {typeof outByeEmptyCount === 'number' && outByeEmptyCount === 0 && (
            <span className="chip chip-empties" title="All starters available">
              <span className="dot g"></span>0
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
