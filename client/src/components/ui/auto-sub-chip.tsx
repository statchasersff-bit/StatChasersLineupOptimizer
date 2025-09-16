import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Copy, Clock, AlertTriangle, ChevronRight } from "lucide-react";
import { AutoSubRecommendation, generateAutoSubInstructions } from "@/lib/autoSubs";
import { useToast } from "@/hooks/use-toast";

interface AutoSubChipProps {
  recommendation: AutoSubRecommendation;
  requireLaterStart?: boolean;
}

export function AutoSubChip({ recommendation, requireLaterStart = false }: AutoSubChipProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { starter, suggestions } = recommendation;

  const copyInstructions = (subName: string) => {
    const instructions = generateAutoSubInstructions(
      starter.name,
      starter.slot,
      subName,
      requireLaterStart
    );
    
    navigator.clipboard.writeText(instructions).then(() => {
      toast({
        title: "Instructions copied!",
        description: "Paste these steps in your notes app"
      });
    }).catch(() => {
      toast({
        title: "Copy failed",
        description: "Please manually copy the instructions",
        variant: "destructive"
      });
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-xs bg-accent text-accent-foreground hover:bg-accent/90 border-accent"
          data-testid={`button-auto-sub-${starter.player_id}`}
        >
          Auto-Sub?
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Auto-Sub for {starter.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p>
              Auto-Subs only fire if <strong>{starter.name}</strong> is INACTIVE at kickoff. 
              If they're active, your starter remains.
            </p>
            {requireLaterStart && (
              <div className="flex items-center gap-1 mt-2 text-amber-600">
                <Clock className="w-4 h-4" />
                <span>Sub must start at or after your starter's game</span>
              </div>
            )}
          </div>
          
          <div className="space-y-3">
            <h4 className="font-medium">Recommended Substitutes:</h4>
            {suggestions.map((suggestion, index) => (
              <div 
                key={suggestion.player.player_id}
                className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium">
                      {suggestion.player.name} ({suggestion.player.pos})
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {suggestion.reason}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyInstructions(suggestion.player.name)}
                    className="ml-2 h-8 px-2"
                    data-testid={`button-copy-instructions-${suggestion.player.player_id}`}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded">
            <strong>How to set:</strong> Go to your Sleeper lineup, tap the bench player you want, 
            then "Set AutoSub" and choose the starter to replace.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface AutoSubBannerProps {
  enabled: boolean;
  requireLaterStart?: boolean;
  allowedPerWeek?: number;
}

export function AutoSubBanner({ enabled, requireLaterStart = false, allowedPerWeek = 0 }: AutoSubBannerProps) {
  if (!enabled) {
    return (
      <div className="bg-muted/50 border border-muted rounded-lg p-3 mb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="w-4 h-4" />
          <span>
            Auto-Subs: OFF • Ask your commissioner to enable in League Settings
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 mb-4">
      <div className="flex items-center gap-2 text-sm">
        <div className="flex items-center gap-1">
          <Badge variant="secondary" className="bg-accent/20 text-accent-foreground">
            Auto-Subs: ON
          </Badge>
          <span className="text-muted-foreground">
            {allowedPerWeek > 0 && `${allowedPerWeek}/week max`}
          </span>
        </div>
        {requireLaterStart && (
          <div className="flex items-center gap-1 text-amber-600">
            <Clock className="w-4 h-4" />
            <span className="text-xs">Sub must start at/after starter's game</span>
          </div>
        )}
      </div>
    </div>
  );
}