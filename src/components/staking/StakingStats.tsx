import { Card } from "@/components/ui/card";
import { ArrowUpRight, Timer, ArrowDownRight } from "lucide-react";

export const StakingStats = () => {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="glass-card p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total ETH Staked</p>
            <h3 className="text-2xl font-semibold">32.5 ETH</h3>
            <p className="text-sm text-mint-600">≈ $89,375 USD</p>
          </div>
          <div className="rounded-full bg-mint-100 p-2">
            <ArrowUpRight className="h-5 w-5 text-mint-700" />
          </div>
        </div>
      </Card>

      <Card className="glass-card p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Network APR</p>
            <h3 className="text-2xl font-semibold">4.8%</h3>
            <p className="text-sm text-mint-600">Ethereum Consensus Layer</p>
          </div>
          <div className="rounded-full bg-mint-100 p-2">
            <Timer className="h-5 w-5 text-mint-700" />
          </div>
        </div>
      </Card>

      <Card className="glass-card p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">ETH Rewards Earned</p>
            <h3 className="text-2xl font-semibold">1.25 ETH</h3>
            <p className="text-sm text-mint-600">≈ $3,437 USD</p>
          </div>
          <div className="rounded-full bg-mint-100 p-2">
            <ArrowDownRight className="h-5 w-5 text-mint-700" />
          </div>
        </div>
      </Card>
    </div>
  );
};