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
  onClick?: () => void;
  isExpanded?: boolean;
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
  onClick,
  isExpanded = false,
}: CompactLeagueRowProps) {
  const getAvatarUrl = () => {
    if (oppAvatar) return oppAvatar;
    const initial = oppName.charAt(0).toUpperCase();
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><rect width="36" height="36" rx="8" fill="%230A2342"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23FFB703" font-family="sans-serif" font-size="18" font-weight="bold">${initial}</text></svg>`)}`;
  };

  return (
    <button 
      className={`lc-row ${isExpanded ? 'lc-row-expanded' : ''}`}
      aria-label={`${leagueName}, ${formatText}, win ${Math.round(winPct*100)} percent`}
      onClick={onClick}
      data-testid={`compact-row-${leagueName.replace(/\s/g, '-').toLowerCase()}`}
    >
      <img className="lc-logo" src={getAvatarUrl()} alt="" />
      <div className="lc-main">
        <div className="lc-title clamp1">{leagueName}</div>
        <div className="lc-sub">
          <span className="lc-chip">{formatText}</span>
          <span className="lc-dot">•</span>
          <span className="lc-muted">{myRecord}</span>
        </div>
      </div>

      <div className="lc-left">
        {locked && <span className="lc-lock" aria-label="Lineup locked">🔒</span>}
        <span className="lc-num">{myProj.toFixed(1)}</span>
      </div>

      <div className="lc-center">
        <div className="lc-bar">
          <div 
            className="lc-bar-fill" 
            style={{width: `${Math.round(winPct*100)}%`}} 
          />
        </div>
        <div className="lc-pct">{Math.round(winPct*100)}%</div>
      </div>

      <div className="lc-right">
        <span className="lc-num">{oppProj.toFixed(1)}</span>
        <span className="lc-opp clamp1">{oppName}</span>
      </div>
    </button>
  );
}
