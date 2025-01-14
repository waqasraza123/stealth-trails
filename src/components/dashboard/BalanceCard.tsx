import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

interface BalanceCardProps {
  title: string;
  amount: string;
  subAmount?: string;
  icon: LucideIcon;
  change: string;
  positive: boolean;
}

export const BalanceCard = ({
  title,
  amount,
  subAmount,
  icon: Icon,
  change,
  positive,
}: BalanceCardProps) => {
  return (
    <Card className="glass-card overflow-hidden p-6 transition-all hover:shadow-xl">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <h3 className="text-2xl font-semibold">{amount}</h3>
          {subAmount && (
            <p className="text-sm text-muted-foreground">{subAmount}</p>
          )}
        </div>
        <div
          className={`rounded-full p-2 ${
            positive ? "bg-mint-100" : "bg-destructive/10"
          }`}
        >
          <Icon
            className={`h-5 w-5 ${
              positive ? "text-mint-700" : "text-destructive"
            }`}
          />
        </div>
      </div>
      <div
        className={`mt-4 text-sm ${
          positive ? "text-mint-700" : "text-destructive"
        }`}
      >
        {change} from last week
      </div>
    </Card>
  );
};