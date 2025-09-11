import Papa from "papaparse";
import { buildProjectionIndex } from "./projections";

export async function fetchBuiltInCSV(season: string, week: string | number) {
  const url = `/projections/${season}/week${String(week).padStart(2,"0")}.csv`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`No built-in projections for ${season} W${week}`);
  const text = await res.text();
  return new Promise<any[]>((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (out) => resolve(out.data as any[]),
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