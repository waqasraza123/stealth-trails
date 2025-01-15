import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";
import { ArrowUpRight, ArrowDownRight, Timer, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Types based on your schema
type PoolStatus = 'active' | 'disabled' | 'paused' | 'closed' | 'completed';

interface StakingPool {
  id: number;
  blockchainPoolId: number | null;
  rewardRate: number;
  totalStakedAmount: bigint;
  totalRewardsPaid: bigint;
  poolStatus: PoolStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Mock data
const mockPools: StakingPool[] = [
  {
    id: 1,
    blockchainPoolId: 1001,
    rewardRate: 12,
    totalStakedAmount: BigInt(1500000),
    totalRewardsPaid: BigInt(50000),
    poolStatus: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    blockchainPoolId: 1002,
    rewardRate: 8,
    totalStakedAmount: BigInt(2500000),
    totalRewardsPaid: BigInt(75000),
    poolStatus: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 3,
    blockchainPoolId: 1003,
    rewardRate: 15,
    totalStakedAmount: BigInt(1000000),
    totalRewardsPaid: BigInt(25000),
    poolStatus: 'paused',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const Staking = () => {
  const [isStaking, setIsStaking] = useState(false);
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [stakeAmount, setStakeAmount] = useState("");
  const [selectedPool, setSelectedPool] = useState<StakingPool | null>(null);
  const { toast } = useToast();

  const handleStake = () => {
    setIsStaking(true);
    // Simulate API call
    setTimeout(() => {
      setIsStaking(false);
      toast({
        title: "Staking Successful",
        description: `Successfully staked ${stakeAmount} STL in pool #${selectedPool?.id}`,
      });
    }, 2000);
  };

  const handleUnstake = () => {
    setIsUnstaking(true);
    // Simulate API call
    setTimeout(() => {
      setIsUnstaking(false);
      toast({
        title: "Unstaking Successful",
        description: `Successfully unstaked from pool #${selectedPool?.id}`,
      });
    }, 2000);
  };

  const getStatusIcon = (status: PoolStatus) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'paused':
        return <Timer className="h-4 w-4 text-yellow-500" />;
      case 'disabled':
      case 'closed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: PoolStatus) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-500';
      case 'paused':
        return 'bg-yellow-500/10 text-yellow-500';
      case 'disabled':
      case 'closed':
        return 'bg-red-500/10 text-red-500';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
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
                <p className="text-sm text-muted-foreground">Average APY</p>
                <h3 className="text-2xl font-semibold">12.5%</h3>
                <p className="text-sm text-mint-600">Across All Pools</p>
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

        <Card className="glass-card p-6">
          <h2 className="text-xl font-semibold mb-4">Available Staking Pools</h2>
          <div className="space-y-4">
            {mockPools.map((pool) => (
              <Card
                key={pool.id}
                className={cn(
                  "p-4 transition-all hover:shadow-lg cursor-pointer",
                  selectedPool?.id === pool.id && "border-mint-500"
                )}
                onClick={() => setSelectedPool(pool)}
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold">Pool #{pool.id}</h3>
                      <Badge variant="outline" className={cn("ml-2", getStatusColor(pool.poolStatus))}>
                        <span className="flex items-center gap-1">
                          {getStatusIcon(pool.poolStatus)}
                          {pool.poolStatus}
                        </span>
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>Reward Rate: {pool.rewardRate}% APY</p>
                      <p>Total Staked: {Number(pool.totalStakedAmount).toLocaleString()} STL</p>
                    </div>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="ml-4"
                        disabled={pool.poolStatus !== 'active'}
                      >
                        Stake
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Stake in Pool #{pool.id}</DialogTitle>
                        <DialogDescription>
                          Enter the amount you want to stake. Current APY: {pool.rewardRate}%
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Amount to Stake</label>
                          <Input
                            type="number"
                            placeholder="0.00"
                            value={stakeAmount}
                            onChange={(e) => setStakeAmount(e.target.value)}
                          />
                          <p className="text-sm text-muted-foreground">
                            Available Balance: 2,500.00 STL
                          </p>
                        </div>
                        <Progress value={33} className="h-2" />
                      </div>
                      <DialogFooter>
                        <LoadingButton
                          onClick={handleStake}
                          loading={isStaking}
                          disabled={!stakeAmount || pool.poolStatus !== 'active'}
                        >
                          Stake Tokens
                        </LoadingButton>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </Card>
            ))}
          </div>
        </Card>

        {selectedPool && (
          <Card className="glass-card p-6">
            <h2 className="text-xl font-semibold mb-4">Your Position in Pool #{selectedPool.id}</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Your Staked Amount</p>
                  <h3 className="text-2xl font-semibold">500.00 STL</h3>
                  <p className="text-sm text-mint-600">≈ $1,000.00 USD</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Earned Rewards</p>
                  <h3 className="text-2xl font-semibold">25.50 STL</h3>
                  <p className="text-sm text-mint-600">≈ $51.00 USD</p>
                </div>
              </div>
              <div className="flex flex-col justify-end space-y-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                      Unstake
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Unstake from Pool #{selectedPool.id}</DialogTitle>
                      <DialogDescription>
                        Choose the amount you want to unstake. Note that unstaking may have a cooldown period.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Amount to Unstake</label>
                        <Input type="number" placeholder="0.00" />
                        <p className="text-sm text-muted-foreground">
                          Staked Balance: 500.00 STL
                        </p>
                      </div>
                      <Progress value={66} className="h-2" />
                    </div>
                    <DialogFooter>
                      <LoadingButton
                        onClick={handleUnstake}
                        loading={isUnstaking}
                        variant="outline"
                      >
                        Unstake Tokens
                      </LoadingButton>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button variant="outline" className="w-full">
                  Claim Rewards
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default Staking;