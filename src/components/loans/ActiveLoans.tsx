import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet } from "lucide-react";

export const ActiveLoans = () => {
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-defi-purple" />
          Active Loans
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <div className="text-sm text-muted-foreground">No active loans</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};