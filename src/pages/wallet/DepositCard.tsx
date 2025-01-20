import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Loader2, QrCode } from "lucide-react";
import { useGetUser } from "@/hooks/user/useGetUser";

const DepositCard = () => {
  const [depositAddress, setDepositAddress] = useState("");

  const userId = JSON.parse(localStorage.getItem("user") || "{}").supabaseUserId || "";
  const { loading: loadingUser, user } = useGetUser(userId);
  
  useEffect(() => {
    if (user?.ethereumAddress) {
      setDepositAddress(user.ethereumAddress);
    }
  }, [user]);

  return (
    <Card className="glass-card overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-defi-purple/5 to-defi-blue/5" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-defi-purple">
          <ArrowUpRight className="h-5 w-5" />
          Quick Deposit
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="rounded-lg border border-defi-purple/20 bg-white/50 backdrop-blur-sm p-4">
            <div className="mb-2 text-sm text-defi-gray">Your Deposit Address</div>
            <div className="flex items-center justify-between gap-4">
              <code className="rounded bg-defi-light-gray px-3 py-2 text-sm font-mono text-defi-purple flex-1 truncate">
                {loadingUser ? <Loader2 className="animate-spin" /> : depositAddress}
              </code>
              <Button variant="outline" size="sm" className="hover:text-defi-purple hover:border-defi-purple">
                <QrCode className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DepositCard;