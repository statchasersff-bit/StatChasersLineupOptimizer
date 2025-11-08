import { RefreshCw, ChevronRight, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

interface MobileStickyFooterProps {
  onReanalyze: () => void;
  onNextLeague?: () => void;
  onBackToAll?: () => void;
  currentIndex?: number;
  totalLeagues?: number;
  isAnalyzing?: boolean;
}

export function MobileStickyFooter({
  onReanalyze,
  onNextLeague,
  onBackToAll,
  currentIndex = 0,
  totalLeagues = 0,
  isAnalyzing = false
}: MobileStickyFooterProps) {
  const hasMultipleLeagues = totalLeagues > 1;
  const hasNextLeague = currentIndex < totalLeagues - 1;

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-border shadow-2xl z-50"
      data-testid="mobile-sticky-footer"
    >
      <div className="px-4 py-3 flex gap-2">
        {/* Back to All Leagues Button */}
        {onBackToAll && hasMultipleLeagues && (
          <button
            onClick={onBackToAll}
            className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            data-testid="button-back-to-all"
          >
            <ArrowLeft className="w-4 h-4" />
            All Leagues
          </button>
        )}

        {/* Re-run Analysis Button */}
        <button
          onClick={onReanalyze}
          disabled={isAnalyzing}
          className="flex-1 bg-primary text-primary-foreground px-4 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="button-reanalyze-mobile"
        >
          <RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
          {isAnalyzing ? 'Analyzing...' : 'Re-analyze'}
        </button>

        {/* Next League Button */}
        {onNextLeague && hasNextLeague && (
          <button
            onClick={onNextLeague}
            className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-green-700 transition-colors"
            data-testid="button-next-league"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* League Counter */}
      {hasMultipleLeagues && (
        <div className="px-4 pb-2 text-xs text-center text-muted-foreground">
          League {currentIndex + 1} of {totalLeagues}
        </div>
      )}
    </motion.div>
  );
}
