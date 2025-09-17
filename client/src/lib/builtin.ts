import Papa from "papaparse";
import { buildProjectionIndex } from "./projections";

export async function fetchBuiltInCSV(season: string, week: string | number) {
  const url = `/projections/${season}/week${String(week).padStart(2,"0")}.csv`;
  console.log(`[builtin] Fetching CSV from: ${url}`);
  const res = await fetch(url, { cache: "no-store" });
  console.log(`[builtin] Fetch response:`, res.status, res.statusText);
  if (!res.ok) throw new Error(`No built-in projections for ${season} W${week}`);
  const text = await res.text();
  console.log(`[builtin] CSV text length:`, text.length);
  return new Promise<any[]>((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (out) => {
        console.log(`[builtin] Papa parse complete, raw data length: ${(out.data as any[]).length}`);
        if (out.data.length > 0) {
          console.log(`[builtin] Sample row:`, out.data[0]);
        }
        
        // Handle both old format (JSON stats) and new format (individual stat columns)
        const rows = (out.data as any[]).map((row, index) => {
          // Convert proj to number
          if (typeof row.proj === 'string') {
            row.proj = parseFloat(row.proj) || 0;
          }
          
          // Check if this is old format (has stats column) or new format (individual columns)
          if (row.stats && typeof row.stats === 'string') {
            // Old format: Parse stats JSON strings to objects
            try {
              row.stats = JSON.parse(row.stats);
            } catch (e) {
              console.warn(`[builtin] Failed to parse stats JSON for player ${row.name} (row ${index}):`, e);
              row.stats = {};
            }
          } else {
            // New format: Collect individual stat columns into stats object
            const stats: Record<string, number> = {};
            const statColumns = [
              "pass_att", "pass_comp", "pass_yd", "pass_td", "pass_int",
              "rush_att", "rush_yd", "rush_td",
              "rec", "rec_yd", "rec_td",
              "fum_lost", "two_pt",
              "xpm", "xpa", "fgm_0_19", "fgm_20_29", "fgm_30_39", "fgm_40_49", "fgm_50p",
              "sacks", "defs_int", "defs_fum_rec", "defs_td", "safety", "blk_kick", "ret_td", "pts_allowed"
            ];
            
            for (const column of statColumns) {
              if (row[column] !== undefined && row[column] !== null && row[column] !== '') {
                const val = parseFloat(row[column]);
                if (!isNaN(val)) {
                  stats[column] = val;
                }
              }
            }
            row.stats = stats;
            
            // Add missing week/season for new format
            if (!row.week) row.week = week;
            if (!row.season) row.season = season;
          }
          
          return row;
        });
        console.log(`[builtin] Processed rows length: ${rows.length}, sample processed:`, rows[0]);
        resolve(rows);
      },
      error: reject
    });
  });
}

export async function loadBuiltInOrSaved({
  season, week,
  loadSaved, saveSaved,
  setProjections, setProjIdx, setBanner
}: {
  season: string; week: string | number;
  loadSaved: (s: string, w: string|number) => { rows?: any[], updatedAt?: string } | null;
  saveSaved: (s: string, w: string|number, rows: any[]) => void;
  setProjections: (rows: any[]) => void;
  setProjIdx: (idx: Record<string, any>) => void;
  setBanner: (msg: string | null) => void;
}) {
  try {
    const rows = await fetchBuiltInCSV(season, week);
    setProjections(rows);
    setProjIdx(buildProjectionIndex(rows));
    saveSaved(season, week, rows); // cache locally for speed/offline
    setBanner(`Using StatChasers built-in projections for Week ${week}, ${season}.`);
    return true;
  } catch {
    const saved = loadSaved(season, week);
    if (saved?.rows?.length) {
      setProjections(saved.rows);
      setProjIdx(buildProjectionIndex(saved.rows));
      setBanner(`Using saved projections (no built-in found) for Week ${week}, ${season}.`);
      return true;
    }
    setBanner(null);
    return false;
  }
}