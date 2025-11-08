import { classifyStarter, type AvailTag } from "@/lib/availability";
import { Lock, AlertCircle, Calendar, Minus, AlertTriangle } from "lucide-react";

interface StarterBadgeProps {
  p?: {
    player_id?: string;
    name?: string;
    pos?: string;
    opp?: string;
    injury_status?: string;
    locked?: boolean;
  };
}

export function StarterBadge({ p }: StarterBadgeProps) {
  const tag = classifyStarter(p);
  
  if (!tag) return null;

  const badgeConfig: Record<NonNullable<AvailTag>, { icon: JSX.Element; bg: string; text: string; label: string }> = {
    OUT: {
      icon: <AlertCircle className="w-3 h-3" />,
      bg: "bg-red-100 dark:bg-red-900/30",
      text: "text-red-700 dark:text-red-300",
      label: "O"
    },
    BYE: {
      icon: <Calendar className="w-3 h-3" />,
      bg: "bg-gray-100 dark:bg-gray-800",
      text: "text-gray-700 dark:text-gray-300",
      label: "BYE"
    },
    EMPTY: {
      icon: <Minus className="w-3 h-3" />,
      bg: "bg-gray-100 dark:bg-gray-800",
      text: "text-gray-700 dark:text-gray-300",
      label: "—"
    },
    QUES: {
      icon: <AlertTriangle className="w-3 h-3" />,
      bg: "bg-yellow-100 dark:bg-yellow-900/30",
      text: "text-yellow-700 dark:text-yellow-300",
      label: "Q"
    },
    LOCKED: {
      icon: <Lock className="w-3 h-3" />,
      bg: "bg-blue-100 dark:bg-blue-900/30",
      text: "text-blue-700 dark:text-blue-300",
      label: "🔒"
    },
  };

  const config = badgeConfig[tag];

  return (
    <span 
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}
      data-testid={`badge-${tag.toLowerCase()}`}
    >
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
}
