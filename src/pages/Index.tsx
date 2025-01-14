import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownRight, DollarSign, Activity } from "lucide-react";
import { BalanceCard } from "@/components/dashboard/BalanceCard";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";

const Index = () => {
  const balances = [
    {
      title: "Total Balance",
      amount: "$12,345.67",
      icon: DollarSign,
      change: "+2.5%",
      positive: true,
    },
    {
      title: "Crypto Balance",
      amount: "₿ 0.45",
      subAmount: "$15,678.90",
      icon: ArrowUpRight,
      change: "-1.2%",
      positive: false,
    },
    {
      title: "Fiat Balance",
      amount: "$5,432.10",
      icon: ArrowDownRight,
      change: "+0.8%",
      positive: true,
    },
  ];

  const recentTransactions = [
    {
      id: "1",
      type: "Deposit",
      amount: "+$1,000.00",
      date: "2024-03-20",
      status: "completed",
    },
    {
      id: "2",
      type: "Withdrawal",
      amount: "-$500.00",
      date: "2024-03-19",
      status: "pending",
    },
    {
      id: "3",
      type: "Transfer",
      amount: "-$250.00",
      date: "2024-03-18",
      status: "completed",
    },
  ];

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-foreground">Welcome Back</h1>
          <Button>
            <Activity className="mr-2 h-4 w-4" />
            View Analytics
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {balances.map((balance, index) => (
            <BalanceCard key={index} {...balance} />
          ))}
        </div>

        <RecentTransactions transactions={recentTransactions} />
      </div>
    </Layout>
  );
};

export default Index;