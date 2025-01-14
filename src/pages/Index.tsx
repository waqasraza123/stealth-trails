import { Card } from "@/components/ui/card";
import { Layout } from "@/components/Layout";
import { ArrowUpRight, ArrowDownRight, DollarSign } from "lucide-react";

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
        {/* Balance Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {balances.map((balance, index) => {
            const Icon = balance.icon;
            return (
              <Card
                key={index}
                className="glass-card overflow-hidden p-6 transition-all hover:shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{balance.title}</p>
                    <h3 className="text-2xl font-semibold">{balance.amount}</h3>
                    {balance.subAmount && (
                      <p className="text-sm text-muted-foreground">
                        {balance.subAmount}
                      </p>
                    )}
                  </div>
                  <div
                    className={`rounded-full p-2 ${
                      balance.positive ? "bg-mint-100" : "bg-destructive/10"
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 ${
                        balance.positive ? "text-mint-700" : "text-destructive"
                      }`}
                    />
                  </div>
                </div>
                <div
                  className={`mt-4 text-sm ${
                    balance.positive ? "text-mint-700" : "text-destructive"
                  }`}
                >
                  {balance.change} from last week
                </div>
              </Card>
            );
          })}
        </div>

        {/* Recent Transactions */}
        <Card className="glass-card p-6">
          <h2 className="mb-6 text-xl font-semibold">Recent Transactions</h2>
          <div className="space-y-4">
            {recentTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-mint-50/50"
              >
                <div className="space-y-1">
                  <p className="font-medium">{transaction.type}</p>
                  <p className="text-sm text-muted-foreground">
                    {transaction.date}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{transaction.amount}</p>
                  <p
                    className={`text-sm ${
                      transaction.status === "completed"
                        ? "text-mint-600"
                        : "text-orange-500"
                    }`}
                  >
                    {transaction.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Layout>
  );
};

export default Index;