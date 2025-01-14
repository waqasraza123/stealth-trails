import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { ArrowUpRight, ArrowDownRight, Timer } from "lucide-react";

const Staking = () => {
  const [isStaking, setIsStaking] = useState(false);
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [stakeAmount, setStakeAmount] = useState("");

  const handleStake = () => {
    setIsStaking(true);
    // Simulate API call
    setTimeout(() => setIsStaking(false), 2000);
  };

  const handleUnstake = () => {
    setIsUnstaking(true);
    // Simulate API call
    setTimeout(() => setIsUnstaking(false), 2000);
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-foreground">
            Staking Dashboard
          </h1>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="glass-card p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Staked</p>
                <h3 className="text-2xl font-semibold">1,234.56 STL</h3>
                <p className="text-sm text-mint-600">≈ $2,469.12 USD</p>
              </div>
              <div className="rounded-full bg-mint-100 p-2">
                <ArrowUpRight className="h-5 w-5 text-mint-700" />
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">APY</p>
                <h3 className="text-2xl font-semibold">12.5%</h3>
                <p className="text-sm text-mint-600">Variable Rate</p>
              </div>
              <div className="rounded-full bg-mint-100 p-2">
                <Timer className="h-5 w-5 text-mint-700" />
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Rewards Earned</p>
                <h3 className="text-2xl font-semibold">45.67 STL</h3>
                <p className="text-sm text-mint-600">≈ $91.34 USD</p>
              </div>
              <div className="rounded-full bg-mint-100 p-2">
                <ArrowDownRight className="h-5 w-5 text-mint-700" />
              </div>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="glass-card p-6">
            <h2 className="mb-4 text-lg font-semibold">Stake STL</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-muted-foreground">
                  Amount to Stake
                </label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                  />
                  <LoadingButton
                    onClick={handleStake}
                    loading={isStaking}
                    className="w-24"
                  >
                    Stake
                  </LoadingButton>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Available Balance</span>
                  <span>2,500.00 STL</span>
                </div>
                <Progress value={33} className="h-2" />
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6">
            <h2 className="mb-4 text-lg font-semibold">Unstake STL</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-muted-foreground">
                  Amount to Unstake
                </label>
                <div className="flex gap-2">
                  <Input type="number" placeholder="0.00" />
                  <LoadingButton
                    onClick={handleUnstake}
                    loading={isUnstaking}
                    variant="outline"
                    className="w-24"
                  >
                    Unstake
                  </LoadingButton>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Staked Balance</span>
                  <span>1,234.56 STL</span>
                </div>
                <Progress value={66} className="h-2" />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Staking;