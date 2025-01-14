interface TransactionItemProps {
  id: string;
  type: string;
  amount: string;
  date: string;
  status: string;
}

export const TransactionItem = ({
  type,
  amount,
  date,
  status,
}: TransactionItemProps) => {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-mint-50/50">
      <div className="space-y-1">
        <p className="font-medium">{type}</p>
        <p className="text-sm text-muted-foreground">{date}</p>
      </div>
      <div className="text-right">
        <p className="font-medium">{amount}</p>
        <p
          className={`text-sm ${
            status === "completed" ? "text-mint-600" : "text-orange-500"
          }`}
        >
          {status}
        </p>
      </div>
    </div>
  );
};