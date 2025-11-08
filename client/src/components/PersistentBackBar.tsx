import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

interface PersistentBackBarProps {
  onClick: () => void;
  visible: boolean;
}

export function PersistentBackBar({ onClick, visible }: PersistentBackBarProps) {
  if (!visible) return null;

  return (
    <motion.div
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      exit={{ y: -100 }}
      className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-border shadow-md"
      data-testid="persistent-back-bar"
    >
      <div className="max-w-7xl mx-auto px-4 py-3">
        <button
          onClick={onClick}
          className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          data-testid="button-back-to-all-leagues"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to All Leagues
        </button>
      </div>
    </motion.div>
  );
}
