import { classifyStarter, type AvailTag } from "@/lib/availability";

interface StarterBadgeProps {
  p?: {
    player_id?: string;
    name?: string;
    pos?: string;
    opp?: string;
    injury_status?: string;
  };
}

export function StarterBadge({ p }: StarterBadgeProps) {
  const tag = classifyStarter(p);
  if (!tag) return null;

  const styles: Record<NonNullable<AvailTag>, string> = {
    OUT: "bg-red-600 text-white",
    BYE: "bg-gray-500 text-white",
    EMPTY: "bg-gray-400 text-white",
    QUES: "bg-amber-500 text-white",
  };

  return (
    <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${styles[tag]}`}>
      {tag}
    </span>
  );
}
