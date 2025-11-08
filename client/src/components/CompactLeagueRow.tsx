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
}: CompactLeagueRowProps) {
  const pct = Math.round(winPct * 100);
  const resIsPos = projResult >= 0;
  const deltaIsPos = deltaOptAct >= 0;

  const getAvatarUrl = () => {
    if (oppAvatar) return oppAvatar;
    const initial = oppName.charAt(0).toUpperCase();
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="14" fill="%230A2342"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23FFB703" font-family="sans-serif" font-size="14" font-weight="bold">${initial}</text></svg>`)}`;
  };

  return (
    <button 
      className={`lc-row ${isExpanded ? 'lc-row-expanded' : ''}`}
      aria-label={`${leagueName}, ${formatText}, win ${pct}%`}
      onClick={onClick}
      data-testid={`compact-row-${leagueName.replace(/\s/g, '-').toLowerCase()}`}
    >
      <div className="lc-left">
        <div className="lc-logo" />
        <div className="lc-main">
          <div className="lc-title clamp1" title={leagueName}>{leagueName}</div>
          <div className="lc-sub clamp1">{formatText}</div>
        </div>
      </div>

      <div className="lc-numblock">
        {locked && <span className="lc-lock" aria-label="Lineup locked">🔒</span>}
        <span className="lc-num">{myProj.toFixed(1)}</span>
      </div>

      <div className="lc-center">
        <div className="lc-bar">
          <div 
            className="lc-bar-fill" 
            style={{width: `${pct}%`}} 
          />
        </div>
        <div className="lc-pct">{pct}%</div>
      </div>

      <div className="lc-right">
        <span className="lc-num">{oppProj.toFixed(1)}</span>
        <img className="lc-opp-ava" src={getAvatarUrl()} alt={oppName} />
      </div>

      {/* Mini stats strip */}
      <div className="lc-strip" aria-label="row details">
        <span className="k">REC</span> <span className="v">{myRecord}</span>
        <span className="sep">·</span>
        <span className="k">Δ</span>
        <span className={`pill ${deltaIsPos ? 'pos' : 'neg'}`}>
          {deltaIsPos ? '↑' : '↓'} {Math.abs(deltaOptAct).toFixed(1)}
        </span>
        <span className="sep">·</span>
        <span className="k">RES</span>
        <span className={`pill ${resIsPos ? 'pos' : 'neg'}`}>
          {resIsPos ? '↑' : '↓'} {Math.abs(projResult).toFixed(1)}
        </span>
        {typeof quesCount === 'number' && quesCount > 0 && (
          <span className="chip chip-ques" title="Questionable">
            <span className="dot dot-yellow"></span>{quesCount}
          </span>
        )}
        {typeof outByeEmptyCount === 'number' && outByeEmptyCount > 0 && (
          <span className="chip chip-out" title="Out/Bye/Empty">
            <span className="dot dot-red"></span>{outByeEmptyCount}
          </span>
        )}
        {typeof outByeEmptyCount === 'number' && outByeEmptyCount === 0 && (
          <span className="chip chip-ok" title="All clear">
            <span className="dot dot-green"></span>0
          </span>
        )}
      </div>
    </button>
  );
}
