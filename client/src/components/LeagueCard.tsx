import React, { useMemo, useState } from "react";
import type { LeagueSummary } from "../lib/types";
import { statusFlags } from "../lib/optimizer";
import { buildLineupDiff } from "../lib/diff";

export default function LeagueCard({ lg }: { lg: LeagueSummary }) {
  const [open, setOpen] = useState(false);

  // TRUE ins/outs based on sets, not slot-by-slot
  const diff = useMemo(() => buildLineupDiff(lg, lg.allEligible), [lg]);
  const changeCount = Math.max(diff.ins.length, diff.outs.length);

  return (
    <div className="rounded-2xl shadow border" data-testid={`card-league-${lg.league_id}`}>
      {/* Header Row (always visible) */}
      <button
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 rounded-2xl transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        data-testid={`button-toggle-${lg.league_id}`}
      >
        <div className="min-w-0">
          <div className="text-sm text-gray-500 truncate" data-testid={`text-manager-${lg.league_id}`}>{lg.rosterUserDisplay}</div>
          <h3 className="text-base md:text-lg font-semibold truncate" data-testid={`text-league-name-${lg.league_id}`}>{lg.name}</h3>
        </div>

        <div className="flex items-center gap-4">
          {/* potential points gain (delta) */}
          <div className={`text-sm md:text-base font-semibold ${lg.delta >= 0 ? "text-green-600" : "text-red-600"}`} data-testid={`text-delta-${lg.league_id}`}>
            {lg.delta >= 0 ? "+" : ""}{lg.delta.toFixed(1)} pts
          </div>
          <div className="text-xs md:text-sm text-gray-500" data-testid={`text-changes-${lg.league_id}`}>{changeCount} changes</div>

          {/* Bench empties badge */}
          {(lg.benchEmpty ?? 0) > 0 && (
            <span className="text-xs md:text-sm rounded-full px-2 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300" data-testid={`text-bench-empty-${lg.league_id}`}>
              {lg.benchEmpty} empty bench {lg.benchEmpty === 1 ? "spot" : "spots"}
            </span>
          )}

          <svg className={`h-5 w-5 transition-transform ${open ? "rotate-180" : "rotate-0"}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.061l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.06z" />
          </svg>
        </div>
      </button>

      {/* Detail (collapsible) */}
      {open && (
        <div className="p-4 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="font-semibold mb-1">Current Starters</div>
              <ul className="space-y-1">
                {lg.starters.map((pid, i) => {
                  const slot = lg.roster_positions[i];
                  
                  // Handle empty slots
                  if (!pid || pid === "0" || pid === "") {
                    return (
                      <li key={i} className="text-sm p-1 rounded" data-testid={`row-current-${i}`}>
                        <span className="inline-block w-28 font-mono">{slot}</span>
                        <span className="text-gray-400 italic">Empty</span>
                      </li>
                    );
                  }
                  
                  // First try to find in enriched starter objects, then in all eligible players
                  const cur = lg.starterObjs?.find(p => p.player_id === pid) || lg.allEligible?.find(p => p.player_id === pid);
                  const flags = statusFlags(cur);
                  // Only highlight if player is truly being removed from lineup (not in optimal at all)
                  const optimalIds = new Set(lg.optimalSlots.map(s => s.player?.player_id).filter(Boolean));
                  const isBeingBenched = !optimalIds.has(pid);
                  return (
                    <li key={i} className={`text-sm p-1 rounded ${isBeingBenched ? 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300' : ''}`} data-testid={`row-current-${i}`}>
                      <span className="inline-block w-28 font-mono">{slot}</span>
                      {cur ? `${cur.name} (${cur.pos}) — ${cur.proj?.toFixed(2) ?? "0.00"}` : `player_id ${pid}`}
                      {flags.length > 0 && <span className="ml-2 text-xs text-amber-600">[{flags.join(", ")}]</span>}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <div className="font-semibold mb-1">Optimal Starters</div>
              <ul className="space-y-1">
                {lg.optimalSlots.map((s, i) => {
                  const p = s.player;
                  const flags = statusFlags(p);
                  
                  if (!p) {
                    return (
                      <li key={i} className="text-sm p-1 rounded" data-testid={`row-optimal-${i}`}>
                        <span className="inline-block w-28 font-mono">{s.slot}</span>
                        —
                      </li>
                    );
                  }

                  const currentIds = new Set(lg.starters.filter((x): x is string => !!x));
                  const benchIds = new Set(lg.bench.filter(Boolean));
                  const isCurrentStarter = currentIds.has(p.player_id);
                  const isBenchPlayer = benchIds.has(p.player_id);
                  const isFreeAgent = !isCurrentStarter && !isBenchPlayer;
                  
                  let highlightClass = '';
                  if (isFreeAgent) {
                    highlightClass = 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-300';
                  } else if (isBenchPlayer) {
                    highlightClass = 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-300';
                  }
                  
                  return (
                    <li key={i} className={`text-sm p-1 rounded ${highlightClass}`} data-testid={`row-optimal-${i}`}>
                      <span className="inline-block w-28 font-mono">{s.slot}</span>
                      {`${p.name} (${p.pos}) — ${p.proj?.toFixed(2) ?? "0.00"}`}
                      {flags.length > 0 && <span className="ml-2 text-xs text-amber-600">[{flags.join(", ")}]</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* NEW: clear recommendations that avoid self-swaps */}
          {diff.moves.length > 0 && (
            <div className="mt-4">
              <div className="font-semibold mb-1">Suggested Changes</div>
              <ul className="space-y-1">
                {diff.moves.map((m, i) => (
                  <li key={i} className="text-sm" data-testid={`row-suggestion-${i}`}>
                    Put <b>{m.in_name}</b> into <b>{m.slot}</b>
                    {m.out_name ? <> (bench <b>{m.out_name}</b>)</> : null}
                    <span className="ml-2 text-green-600">(+{m.gain.toFixed(2)} pts)</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-3 text-sm" data-testid={`text-totals-${lg.league_id}`}>
            Current total: <b>{lg.currentTotal.toFixed(2)}</b> — Optimal total: <b>{lg.optimalTotal.toFixed(2)}</b>
          </div>

          <div className="mt-1 text-xs text-gray-600" data-testid={`text-bench-details-${lg.league_id}`}>
            Bench: {lg.benchCount ?? 0}/{lg.benchCapacity ?? 0}
            {(lg.benchEmpty ?? 0) > 0 && <> — <span className="text-amber-700">{lg.benchEmpty} empty</span></>}
          </div>

          {lg.waiverSuggestions && lg.waiverSuggestions.length > 0 && (
            <div className="mt-4">
              {(lg.benchEmpty ?? 0) > 0 && (
                <div className="mb-2 text-xs text-emerald-700 dark:text-emerald-400">
                  You have open bench slots — consider adding top waiver targets below.
                </div>
              )}
              <div className="font-semibold mb-1">Waiver Watchlist</div>
              <ul className="space-y-1">
                {lg.waiverSuggestions.slice(0, 10).map((w, i) => (
                  <li key={i} className="text-sm" data-testid={`row-waiver-${i}`}>
                    Put <b>{w.name}</b> into <b>{w.replaceSlot}</b>
                    {w.currentPlayerName && w.currentPlayerName !== "[EMPTY]" ? <> (bench <b>{w.currentPlayerName}</b>)</> : null}
                    <span className="ml-2 text-green-600">(+{w.gain.toFixed(2)} pts)</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {lg.rosterHealth && (
            <div className="mt-4" data-testid={`roster-health-${lg.league_id}`}>
              <div className="font-semibold">Roster Health</div>
              <div className="text-xs text-gray-600 mb-2">
                Surplus/shortage are vs. replacement-level free agents (league scoring).
              </div>

              <table className="w-full text-sm border-separate border-spacing-y-1" data-testid={`table-roster-health-${lg.league_id}`}>
                <thead className="text-xs text-gray-500">
                  <tr>
                    <th className="text-left">Pos</th>
                    <th className="text-right">Demand</th>
                    <th className="text-right">Starters</th>
                    <th className="text-right">Depth (wgt)</th>
                    <th className="text-right">Repl/Start</th>
                    <th className="text-right">Surplus</th>
                  </tr>
                </thead>
                <tbody>
                  {lg.rosterHealth.byPos.map(p => (
                    <tr key={p.pos} data-testid={`row-position-${p.pos}`}>
                      <td className="font-mono">{p.pos}</td>
                      <td className="text-right">{p.demand}</td>
                      <td className="text-right">{p.startersProj.toFixed(1)}</td>
                      <td className="text-right">{p.depthProjWeighted.toFixed(1)}</td>
                      <td className="text-right">{p.replacementBaseline.toFixed(1)}</td>
                      <td className={`text-right ${p.surplus >= 0 ? "text-emerald-600" : "text-rose-600"}`} data-testid={`text-surplus-${p.pos}`}>
                        {p.surplus.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-2 text-sm" data-testid={`text-health-summary-${lg.league_id}`}>
                <b>Strongest:</b> {lg.rosterHealth.strongest.join(", ")} • <b>Weakest:</b> {lg.rosterHealth.weakest.join(", ")}
              </div>

              {lg.rosterHealth.tradeIdeas.length > 0 && (
                <div className="mt-2 text-sm" data-testid={`text-trade-ideas-${lg.league_id}`}>
                  <b>Trade Ideas:</b>
                  <ul className="list-disc ml-6">
                    {lg.rosterHealth.tradeIdeas.map((t, i) => (
                      <li key={i} data-testid={`row-trade-idea-${i}`}>
                        Package from <b>{t.give}</b> to address <b>{t.forNeed}</b> — {t.rationale}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {lg.rosterHealth.addDropIdeas.length > 0 && (
                <div className="mt-2 text-sm" data-testid={`text-waiver-ideas-${lg.league_id}`}>
                  <b>Waiver Ideas:</b>
                  <ul className="list-disc ml-6">
                    {lg.rosterHealth.addDropIdeas.map((w, i) => (
                      <li key={i} data-testid={`row-waiver-idea-${i}`}>
                        {w.pos}: Add <b>{w.addName}</b> (+{w.gain.toFixed(2)} pts)
                        {w.dropName && <> ; drop <b>{w.dropName}</b></>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
