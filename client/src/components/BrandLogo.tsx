import { TrendingUp } from "lucide-react";

export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative">
        {/* Logo icon with animated pulse */}
        <div className="absolute inset-0 bg-secondary rounded-lg blur-sm opacity-50 animate-pulse-gold"></div>
        <div className="relative bg-navy-gradient p-2 rounded-lg shadow-lg">
          <TrendingUp className="w-5 h-5 text-secondary" strokeWidth={2.5} />
        </div>
      </div>
      <div className="flex flex-col leading-none">
        <span className="font-bold text-lg text-primary dark:text-primary-foreground">
          StatChasers
        </span>
        <span className="text-[10px] text-secondary font-semibold tracking-wider uppercase">
          Lineup Checker
        </span>
      </div>
    </div>
  );
}

export function BrandBadge({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 bg-navy-gradient rounded-full shadow-md ${className}`}>
      <TrendingUp className="w-3.5 h-3.5 text-secondary" strokeWidth={2.5} />
      <span className="text-xs font-bold text-white tracking-wide">
        StatChasers
      </span>
    </div>
  );
}
