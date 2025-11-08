import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatSummaryCardProps {
  id: string;
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
  description?: string;
  delta?: number;
  trend?: 'up' | 'down' | 'flat';
  className?: string;
}

const toneStyles = {
  blue: {
    bg: 'from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    icon: 'text-blue-600 dark:text-blue-400',
    value: 'text-blue-700 dark:text-blue-300',
    trend: {
      up: 'text-blue-600 dark:text-blue-400',
      down: 'text-blue-400 dark:text-blue-500',
    },
  },
  green: {
    bg: 'from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    icon: 'text-green-600 dark:text-green-400',
    value: 'text-green-700 dark:text-green-300',
    trend: {
      up: 'text-green-600 dark:text-green-400',
      down: 'text-green-400 dark:text-green-500',
    },
  },
  red: {
    bg: 'from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    icon: 'text-red-600 dark:text-red-400',
    value: 'text-red-700 dark:text-red-300',
    trend: {
      up: 'text-red-600 dark:text-red-400',
      down: 'text-red-400 dark:text-red-500',
    },
  },
  yellow: {
    bg: 'from-yellow-50 to-yellow-100/50 dark:from-yellow-950/30 dark:to-yellow-900/20',
    border: 'border-yellow-200 dark:border-yellow-800',
    icon: 'text-yellow-600 dark:text-yellow-500',
    value: 'text-yellow-700 dark:text-yellow-300',
    trend: {
      up: 'text-yellow-600 dark:text-yellow-400',
      down: 'text-yellow-400 dark:text-yellow-500',
    },
  },
  purple: {
    bg: 'from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20',
    border: 'border-purple-200 dark:border-purple-800',
    icon: 'text-purple-600 dark:text-purple-400',
    value: 'text-purple-700 dark:text-purple-300',
    trend: {
      up: 'text-purple-600 dark:text-purple-400',
      down: 'text-purple-400 dark:text-purple-500',
    },
  },
};

export function StatSummaryCard({
  id,
  label,
  value,
  icon: Icon,
  tone,
  description,
  delta,
  trend,
  className = '',
}: StatSummaryCardProps) {
  const styles = toneStyles[tone];
  
  const renderTrendIndicator = () => {
    if (!trend || trend === 'flat' || delta === undefined || delta === 0) {
      return null;
    }

    const TrendIcon = trend === 'up' ? TrendingUp : TrendingDown;
    const trendColor = styles.trend[trend];

    return (
      <div className={`flex items-center gap-1 text-xs font-medium ${trendColor} ml-2`}>
        <TrendIcon className="w-3.5 h-3.5" />
        <span>{Math.abs(delta).toFixed(trend === 'up' && tone === 'green' ? 1 : 0)}</span>
      </div>
    );
  };

  return (
    <div
      className={`card rounded-lg border-2 ${styles.border} bg-gradient-to-br ${styles.bg} shadow-md hover:shadow-lg transition-all duration-300 p-4 ${className}`}
      data-testid={`stat-card-${id}`}
    >
      <div className="flex items-start justify-between mb-2">
        <Icon className={`w-5 h-5 ${styles.icon}`} />
        {renderTrendIndicator()}
      </div>
      
      <div className="space-y-1">
        <div className={`text-2xl sm:text-3xl font-bold ${styles.value} animate-numberPop flex items-baseline`}>
          {value}
        </div>
        <div className="text-xs sm:text-sm text-muted-foreground font-medium">
          {label}
        </div>
        {description && (
          <div className="text-xs text-muted-foreground/80 mt-1.5 leading-relaxed">
            {description}
          </div>
        )}
      </div>
    </div>
  );
}
