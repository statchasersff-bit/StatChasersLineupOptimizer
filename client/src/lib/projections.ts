import Papa from "papaparse";
import type { Projection } from "./types";

// Safe number conversion
const num = (v: any) => (v === null || v === undefined || v === "" ? 0 : Number(v) || 0);

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
          const rows: any[] = res.data as any[];
          const mapped = rows.map((raw) => {
            const base = {
              sleeper_id: (raw.sleeper_id ?? raw.SLEEPER_ID ?? raw.player_id ?? raw.PLAYER_ID)?.toString()?.trim() || undefined,
              name: (raw.name ?? raw.NAME ?? "").toString().trim(),
              team: (raw.team ?? raw.TEAM ?? "").toString().trim().toUpperCase() || undefined,
              pos: normalizePos((raw.pos ?? raw.POS ?? "").toString().trim()),
              proj: num(raw.proj ?? raw.PROJ),
              opp: (raw.opp ?? raw.OPP ?? "").toString().trim(),
            };

            // attach stat-level fields (only numbers; missing => 0)
            const stats: Record<string, number> = {};
            const keys = [
              "pass_yd","pass_td","pass_int","rush_yd","rush_td","rec","rec_yd","rec_td","fum_lost","two_pt",
              "xpm","xpa","fgm_0_19","fgm_20_29","fgm_30_39","fgm_40_49","fgm_50p",
              "sacks","defs_int","defs_fum_rec","defs_td","safety","blk_kick","ret_td","pts_allowed"
            ];
            keys.forEach(k => { if (k in raw) (stats as any)[k] = num(raw[k]); });

            return { ...base, stats };
          });

          resolve(mapped as any);
        } catch (e) { reject(e); }
      },
      error: reject,
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
    ["sleeper_id","name","team","pos","proj","opp","pass_yd","pass_td","rush_yd","rush_td","rec","rec_yd","rec_td"].join(","),
    ["4034","Patrick Mahomes","KC","QB","24.3","","280","2","25","0","0","0","0"].join(","),
    ["6787","Christian McCaffrey","SF","RB","21.9","","0","0","95","1","4","35","0"].join(","),
    ["6792","Justin Jefferson","MIN","WR","20.1","","0","0","0","0","8","110","1"].join(","),
    ["4046","Travis Kelce","KC","TE","17.4","","0","0","0","0","6","75","1"].join(","),
    ["9001","Generic Kicker","FA","K","8.0","","0","0","0","0","0","0","0"].join(","),
    ["4999","San Francisco 49ers","SF","DEF","7.1","","0","0","0","0","0","0","0"].join(","),
  ].join("\n");
}
