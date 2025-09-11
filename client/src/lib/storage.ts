const KEY = (season: string, week: string | number) => `stc_proj_${season}_w${week}`;

type StoredProjections = {
  schema: 1;
  updatedAt: string;          // ISO
  rows: any[];                // parsed Projection rows (what you already use)
};

export function saveProjections(season: string, week: string | number, rows: any[]) {
  const payload: StoredProjections = { schema: 1, updatedAt: new Date().toISOString(), rows };
  localStorage.setItem(KEY(season, week), JSON.stringify(payload));
}

export function loadProjections(season: string, week: string | number): StoredProjections | null {
  const raw = localStorage.getItem(KEY(season, week));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function clearProjections(season: string, week: string | number) {
  localStorage.removeItem(KEY(season, week));
}