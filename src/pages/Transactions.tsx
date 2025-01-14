import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const Transactions = () => {
  const transactions = [
    {
      id: "1",
      type: "Deposit",
      amount: "+$1,000.00",
      date: "2024-03-20",
      status: "completed",
      address: "0x1234...5678",
    },
    {
      id: "2",
      type: "Withdrawal",
      amount: "-$500.00",
      date: "2024-03-19",
      status: "pending",
      address: "0x8765...4321",
    },
    {
      id: "3",
      type: "Transfer",
      amount: "-$250.00",
      date: "2024-03-18",
      status: "completed",
      address: "0x9876...1234",
    },
  ];

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-foreground">Transactions</h1>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              className="pl-10"
            />
          </div>
        </div>

        <Card className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Type</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Amount</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Address</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b last:border-0 hover:bg-mint-50/50">
                    <td className="px-6 py-4">{tx.type}</td>
                    <td className={`px-6 py-4 ${
                      tx.amount.startsWith("+") ? "text-mint-600" : "text-destructive"
                    }`}>
                      {tx.amount}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{tx.date}</td>
                    <td className="px-6 py-4 font-mono text-sm">{tx.address}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          tx.status === "completed"
                            ? "bg-mint-100 text-mint-700"
                            : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </Layout>
  );
};

export default Transactions;