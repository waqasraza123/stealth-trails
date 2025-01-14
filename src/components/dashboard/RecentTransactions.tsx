import { Card } from "@/components/ui/card";
import { TransactionItem } from "./TransactionItem";

interface Transaction {
  id: string;
  type: string;
  amount: string;
  date: string;
  status: string;
}

interface RecentTransactionsProps {
  transactions: Transaction[];
}

export const RecentTransactions = ({ transactions }: RecentTransactionsProps) => {
  return (
    <Card className="glass-card p-6">
      <h2 className="mb-6 text-xl font-semibold">Recent Transactions</h2>
      <div className="space-y-4">
        {transactions.map((transaction) => (
          <TransactionItem key={transaction.id} {...transaction} />
        ))}
      </div>
    </Card>
  );
};