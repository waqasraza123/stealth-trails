import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
    <Card className="gradient-border overflow-hidden group hover:scale-[1.02] transition-all duration-300">
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <h3 className="text-2xl font-semibold bg-gradient-to-r from-defi-purple to-defi-blue bg-clip-text text-transparent">
              {amount}
            </h3>
            {subAmount && (
              <p className="text-sm text-muted-foreground">{subAmount}</p>
            )}
          </div>
          <div className={cn(
            "rounded-full p-3 transition-colors",
            positive ? "bg-defi-purple/10 text-defi-purple" : "bg-destructive/10 text-destructive"
          )}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className={cn(
          "flex items-center space-x-2 text-sm",
          positive ? "text-defi-purple" : "text-destructive"
        )}>
          <span className="font-medium">{change}</span>
          <span className="text-muted-foreground">from last week</span>
        </div>
      </div>
    </Card>
  );
};