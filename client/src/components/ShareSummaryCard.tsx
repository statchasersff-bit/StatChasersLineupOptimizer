import { Trophy, TrendingUp, AlertTriangle, Target, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ShareSummaryCardProps {
  username: string;
  week: string;
  season: string;
  leaguesCount: number;
  projectedRecord: { wins: number; losses: number; ties: number };
  totalPotential: number;
  totalAlerts: number;
}

export function ShareSummaryCard({
  username,
  week,
  season,
  leaguesCount,
  projectedRecord,
  totalPotential,
  totalAlerts
}: ShareSummaryCardProps) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const summaryText = `📊 StatChasers Week ${week} Summary
  
👤 ${username}
📅 Season ${season}, Week ${week}
🏆 ${leaguesCount} League${leaguesCount !== 1 ? 's' : ''} Analyzed

📈 Projected Record: ${projectedRecord.wins}-${projectedRecord.losses}${projectedRecord.ties > 0 ? `-${projectedRecord.ties}` : ''}
⚡ Total Potential: +${totalPotential.toFixed(1)} pts
⚠️ Alerts: ${totalAlerts} player${totalAlerts !== 1 ? 's' : ''}

Powered by StatChasers Lineup Checker`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
          data-testid="button-share-summary"
        >
          <Trophy className="w-4 h-4" />
          <span className="hidden sm:inline">Share Summary</span>
          <span className="sm:hidden">Share</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Weekly Summary</DialogTitle>
          <DialogDescription>
            Share your fantasy football performance
          </DialogDescription>
        </DialogHeader>
        
        {/* Summary Card */}
        <div className="bg-gradient-to-br from-primary/10 via-card to-accent/10 border-2 border-primary/20 rounded-lg p-6 space-y-4">
          {/* Header */}
          <div className="text-center border-b border-border pb-3">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Trophy className="w-6 h-6 text-secondary animate-pulse-gold" />
              <h3 className="text-lg font-bold text-foreground">Week {week} Summary</h3>
            </div>
            <p className="text-sm text-muted-foreground">Season {season}</p>
          </div>

          {/* User Info */}
          <div className="text-center">
            <p className="text-2xl font-bold text-primary mb-1">{username}</p>
            <p className="text-sm text-muted-foreground">{leaguesCount} League{leaguesCount !== 1 ? 's' : ''} Analyzed</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <div className="flex items-center justify-center mb-1">
                <Target className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-xs text-muted-foreground mb-1">Record</p>
              <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                {projectedRecord.wins}-{projectedRecord.losses}{projectedRecord.ties > 0 ? `-${projectedRecord.ties}` : ''}
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <div className="flex items-center justify-center mb-1">
                <TrendingUp className="w-4 h-4 text-green-500" />
              </div>
              <p className="text-xs text-muted-foreground mb-1">Potential</p>
              <p className="text-sm font-bold text-accent">+{totalPotential.toFixed(1)}</p>
            </div>

            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <div className="flex items-center justify-center mb-1">
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              <p className="text-xs text-muted-foreground mb-1">Alerts</p>
              <p className="text-sm font-bold text-red-600 dark:text-red-400">{totalAlerts}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-muted-foreground pt-3 border-t border-border">
            Powered by StatChasers Lineup Checker
          </div>
        </div>

        {/* Copy Button */}
        <Button
          onClick={handleCopy}
          className="w-full"
          data-testid="button-copy-summary"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2" />
              Copy as Text
            </>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Take a screenshot to share on social media!
        </p>
      </DialogContent>
    </Dialog>
  );
}
