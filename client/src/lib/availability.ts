export type AvailTag = "OUT" | "BYE" | "EMPTY" | "QUES" | null;

const OUT_STATUSES = new Set(["O", "IR", "NA", "SUS", "SSPD"]);
const Q_STATUSES = new Set(["Q", "D"]);

export function classifyStarter(p?: {
  player_id?: string;
  name?: string;
  pos?: string;
  opp?: string;
  injury_status?: string;
}): AvailTag {
  if (!p || !p.player_id) return "EMPTY";
  const s = (p.injury_status || "").toUpperCase();
  if (p.opp === "BYE") return "BYE";
  if (OUT_STATUSES.has(s)) return "OUT";
  if (Q_STATUSES.has(s)) return "QUES";
  return null;
}

export type Starter = {
  player_id?: string;
  name?: string;
  opp?: string;
  injury_status?: string;
  slot: string;
  proj?: number;
  pos?: string;
};

export function summarizeStarters(starters: Starter[]) {
  const outByeEmpty: Starter[] = [];
  const ques: Starter[] = [];

  for (const s of starters) {
    const tag = classifyStarter(s);
    if (tag === "OUT" || tag === "BYE" || tag === "EMPTY") outByeEmpty.push(s);
    else if (tag === "QUES") ques.push(s);
  }

  return {
    notPlayingCount: outByeEmpty.length,
    notPlayingList: outByeEmpty.map(s => ({
      id: s.player_id,
      name: s.name,
      tag: classifyStarter(s),
      slot: s.slot
    })),
    quesCount: ques.length,
    quesList: ques.map(s => ({
      id: s.player_id,
      name: s.name,
      slot: s.slot
    })),
  };
}
