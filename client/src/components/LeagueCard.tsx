import React from "react";
import type { LeagueSummary } from "../lib/types";
import { statusFlags } from "../lib/optimizer";
import { ArrowUp, Download } from "lucide-react";

export default function LeagueCard({ lg }: { lg: LeagueSummary }) {
  const handleExport = () => {
    const csvData = [
      ['Position', 'Current Player', 'Current Proj', 'Optimal Player', 'Optimal Proj', 'Change'],
      ...lg.optimalSlots.map((optSlot, i) => {
        const currentPlayerId = lg.starters[i];
        const currentPlayer = lg.optimalSlots.find(s => s.player?.player_id === currentPlayerId)?.player;
        const optPlayer = optSlot.player;
        const isChange = currentPlayerId !== optPlayer?.player_id;
        
        return [
          optSlot.slot,
          currentPlayer?.name || 'Empty',
          currentPlayer?.proj?.toFixed(2) || '0.00',
          optPlayer?.name || 'Empty',
          optPlayer?.proj?.toFixed(2) || '0.00',
          isChange ? 'YES' : 'NO'
        ];
      })
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lg.name.replace(/[^a-z0-9]/gi, '_')}_analysis.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="league-card card rounded-lg border border-border shadow-sm p-6 fade-in" data-testid={`card-league-${lg.league_id}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold mb-1" data-testid={`text-league-name-${lg.league_id}`}>{lg.name}</h3>
          <p className="text-sm text-muted-foreground" data-testid={`text-manager-${lg.league_id}`}>Managed by: {lg.rosterUserDisplay}</p>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${lg.delta >= 0 ? "text-accent" : "text-destructive"}`} data-testid={`text-delta-${lg.league_id}`}>
            {lg.delta >= 0 ? '+' : ''}{lg.delta.toFixed(1)}
          </div>
          <div className="text-sm text-muted-foreground">Potential Points</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Lineup */}
        <div>
          <h4 className="font-medium mb-3 flex items-center">
            <i className="fas fa-users mr-2 text-muted-foreground"></i>
            Current Starters
          </h4>
          <div className="space-y-2">
            {lg.starters.map((pid, i) => {
              const slot = lg.roster_positions.filter(s => !["BN","IR","TAXI"].includes(s))[i];
              const cur = lg.optimalSlots.find(s => s.player?.player_id === pid)?.player;
              const flags = statusFlags(cur);
              const shouldReplace = pid !== lg.optimalSlots[i]?.player?.player_id;
              return (
                <div key={i} className={`flex justify-between items-center p-2 rounded ${
                  shouldReplace ? 'bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-900/30' : 'bg-muted/50'
                }`} data-testid={`row-current-${i}`}>
                  <div className="flex items-center space-x-3">
                    <span className="w-8 text-xs font-mono text-muted-foreground">{slot}</span>
                    <span className={`font-medium ${shouldReplace ? 'text-red-700 dark:text-red-300' : ''}`}>
                      {cur ? `${cur.name} (${cur.pos})` : `player_id ${pid}`}
                    </span>
                    {flags.length > 0 && (
                      <div className="flex gap-1">
                        {flags.map(flag => (
                          <span key={flag} className={`status-badge ${
                            flag === 'OUT' ? 'status-out' : 
                            flag === 'DOUB' ? 'status-doubtful' : 
                            flag === 'BYE' ? 'status-bye' : ''
                          }`}>
                            {flag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-medium" data-testid={`text-current-proj-${i}`}>{cur?.proj?.toFixed(1) ?? "0.0"}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 p-2 bg-secondary rounded">
            <div className="font-medium" data-testid={`text-current-total-${lg.league_id}`}>Current Total: {lg.currentTotal.toFixed(1)} pts</div>
          </div>
        </div>

        {/* Optimal Lineup */}
        <div>
          <h4 className="font-medium mb-3 flex items-center">
            <i className="fas fa-star mr-2 text-accent"></i>
            Optimal Starters
          </h4>
          <div className="space-y-2">
            {lg.optimalSlots.map((s, i) => {
              const p = s.player;
              const flags = statusFlags(p);
              const currentPlayerId = lg.starters[i];
              const isAddition = currentPlayerId !== p?.player_id;
              return (
                <div key={i} className={`flex justify-between items-center p-2 rounded ${
                  isAddition ? 'bg-green-50 border border-green-200 dark:bg-green-950/20 dark:border-green-900/30' : 'bg-muted/50'
                }`} data-testid={`row-optimal-${i}`}>
                  <div className="flex items-center space-x-3">
                    <span className="w-8 text-xs font-mono text-muted-foreground">{s.slot}</span>
                    <span className={`font-medium ${isAddition ? 'text-green-700 dark:text-green-300' : ''}`}>
                      {p ? `${p.name} (${p.pos})` : "—"}
                    </span>
                    {isAddition && <ArrowUp className="w-3 h-3 text-accent" />}
                    {flags.length > 0 && (
                      <div className="flex gap-1">
                        {flags.map(flag => (
                          <span key={flag} className={`status-badge ${
                            flag === 'OUT' ? 'status-out' : 
                            flag === 'DOUB' ? 'status-doubtful' : 
                            flag === 'BYE' ? 'status-bye' : ''
                          }`}>
                            {flag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-medium" data-testid={`text-optimal-proj-${i}`}>{p?.proj?.toFixed(1) ?? "0.0"}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 p-2 bg-accent/10 rounded">
            <div className="font-medium text-accent" data-testid={`text-optimal-total-${lg.league_id}`}>Optimal Total: {lg.optimalTotal.toFixed(1)} pts</div>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            Suggested Changes: {lg.optimalSlots.filter((s, i) => lg.starters[i] !== s.player?.player_id).length} players
          </div>
          <button 
            className="bg-accent text-accent-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2"
            onClick={handleExport}
            data-testid={`button-export-${lg.league_id}`}
          >
            <Download className="w-4 h-4" />
            Export Analysis
          </button>
        </div>
      </div>
    </div>
  );
}
