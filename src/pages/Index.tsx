import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownRight, DollarSign, Activity, TrendingUp } from "lucide-react";
import { BalanceCard } from "@/components/dashboard/BalanceCard";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { Card } from "@/components/ui/card";

const Index = () => {
  const balances = [
    {
      title: "Portfolio Value",
      amount: "$12,345.67",
      icon: DollarSign,
      change: "+2.5%",
      positive: true,
    },
    {
      title: "ETH Balance",
      amount: "Ξ 2.45",
      subAmount: "$4,678.90",
      icon: ArrowUpRight,
      change: "+1.2%",
      positive: true,
    },
    {
      title: "Total Staked",
      amount: "Ξ 1.5",
      subAmount: "$2,832.10",
      icon: TrendingUp,
      change: "+0.8%",
      positive: true,
    },
  ];

  const recentTransactions = [
    {
      id: "1",
      type: "Stake ETH",
      amount: "+1.5 ETH",
      date: "2024-03-20",
      status: "completed",
    },
    {
      id: "2",
      type: "Unstake ETH",
      amount: "-0.5 ETH",
      date: "2024-03-19",
      status: "pending",
    },
    {
      id: "3",
      type: "Rewards Claimed",
      amount: "+0.02 ETH",
      date: "2024-03-18",
      status: "completed",
    },
  ];

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-foreground">Dashboard</h1>
          <Button>
            <Activity className="mr-2 h-4 w-4" />
            View History
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {balances.map((balance, index) => (
            <BalanceCard key={index} {...balance} />
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="glass-card p-6">
            <h2 className="mb-4 text-xl font-semibold">ETH Price Chart</h2>
            <div className="h-[300px] rounded-lg bg-gradient-to-br from-mint-50/20 to-mint-100/20 backdrop-blur-sm">
              {/* Chart component would go here */}
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Price chart coming soon
              </div>
            </div>
          </Card>
          <RecentTransactions transactions={recentTransactions} />
        </div>
      </div>
    </Layout>
  );
};

export default Index;