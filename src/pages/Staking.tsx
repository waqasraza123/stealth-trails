import { Layout } from "@/components/Layout";
import { useState } from "react";
import { StakingStats } from "@/components/staking/StakingStats";
import { PoolCard } from "@/components/staking/PoolCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
    rewardRate: 4.8,
    totalStakedAmount: BigInt(32000000000000000000), // 32 ETH
    totalRewardsPaid: BigInt(1500000000000000000), // 1.5 ETH
    poolStatus: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    blockchainPoolId: 1002,
    rewardRate: 4.5,
    totalStakedAmount: BigInt(64000000000000000000), // 64 ETH
    totalRewardsPaid: BigInt(2800000000000000000), // 2.8 ETH
    poolStatus: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 3,
    blockchainPoolId: 1003,
    rewardRate: 5.2,
    totalStakedAmount: BigInt(96000000000000000000), // 96 ETH
    totalRewardsPaid: BigInt(4200000000000000000), // 4.2 ETH
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
    setTimeout(() => {
      setIsStaking(false);
      toast({
        title: "Staking Successful",
        description: `Successfully staked ${stakeAmount} ETH in pool #${selectedPool?.id}`,
      });
    }, 2000);
  };

  const handleUnstake = () => {
    setIsUnstaking(true);
    setTimeout(() => {
      setIsUnstaking(false);
      toast({
        title: "Unstaking Successful",
        description: `Successfully unstaked from pool #${selectedPool?.id}`,
      });
    }, 2000);
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-foreground">
            Ethereum Staking
          </h1>
          <Link to="/create-pool">
            <Button variant="outline">Create New Pool</Button>
          </Link>
        </div>

        <StakingStats />

        <Card className="glass-card p-6">
          <h2 className="text-xl font-semibold mb-4">Available Validator Pools</h2>
          <div className="space-y-4">
            {mockPools.map((pool) => (
              <PoolCard
                key={pool.id}
                pool={pool}
                onSelect={setSelectedPool}
                isSelected={selectedPool?.id === pool.id}
              />
            ))}
          </div>
        </Card>

        {selectedPool && (
          <Card className="glass-card p-6 animate-in">
            <h2 className="text-xl font-semibold mb-4">Your Position in Pool #{selectedPool.id}</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Your Staked ETH</p>
                  <h3 className="text-2xl font-semibold">16.0 ETH</h3>
                  <p className="text-sm text-mint-600">≈ $44,000 USD</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Earned Rewards</p>
                  <h3 className="text-2xl font-semibold">0.768 ETH</h3>
                  <p className="text-sm text-mint-600">≈ $2,112 USD</p>
                </div>
              </div>
              <div className="flex flex-col justify-end space-y-2">
                <Dialog>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Unstake from Pool #{selectedPool.id}</DialogTitle>
                      <DialogDescription>
                        Choose the amount you want to unstake. Note that unstaking has a cooldown period of approximately 2-3 days.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Amount to Unstake</label>
                        <Input type="number" placeholder="0.00" />
                        <p className="text-sm text-muted-foreground">
                          Staked Balance: 16.0 ETH
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
                        Initiate Unstaking
                      </LoadingButton>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button variant="outline" className="w-full">
                  Claim ETH Rewards
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