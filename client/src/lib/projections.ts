import Papa from "papaparse";
import type { Projection } from "./types";

export function normalizePos(p?: string) {
  if (!p) return "";
  const up = p.toUpperCase();
  if (["DST","D/ST","DEF","D"].includes(up)) return "DEF";
  return up;
}

export function parseProjections(file: File): Promise<Projection[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        try {
          const rows: Projection[] = (res.data as any[]).map((raw) => ({
            sleeper_id: (raw.sleeper_id ?? raw.SLEEPER_ID ?? raw.player_id ?? raw.PLAYER_ID)?.toString()?.trim() || undefined,
            name: (raw.name ?? raw.NAME ?? "").toString().trim(),
            team: (raw.team ?? raw.TEAM ?? "").toString().trim().toUpperCase() || undefined,
            pos: normalizePos((raw.pos ?? raw.POS ?? "").toString().trim()),
            proj: Number(raw.proj ?? raw.PROJ ?? 0) || 0,
            opp: (raw.opp ?? raw.OPP ?? "").toString().trim(),
          }));
          resolve(rows);
        } catch (e) { reject(e); }
      },
      error: (err) => reject(err),
    });
  });
}

export function buildProjectionIndex(rows: Projection[]) {
  const idx: Record<string, Projection> = {};
  for (const r of rows) {
    if (r.sleeper_id) idx[r.sleeper_id] = r;
    const key = `${r.name.toLowerCase()}|${r.team ?? ""}|${r.pos}`;
    idx[key] = r;
  }
  return idx;
}

export function csvTemplate(): string {
  return [
    ["sleeper_id","name","team","pos","proj","opp"].join(","),
    ["4034","Patrick Mahomes","KC","QB","24.3",""].join(","),
    ["6787","Christian McCaffrey","SF","RB","21.9",""].join(","),
    ["6792","Justin Jefferson","MIN","WR","20.1",""].join(","),
    ["4046","Travis Kelce","KC","TE","17.4",""].join(","),
    ["9001","Generic Kicker","FA","K","8.0",""].join(","),
    ["4999","San Francisco 49ers","SF","DEF","7.1",""].join(","),
  ].join("\n");
}
