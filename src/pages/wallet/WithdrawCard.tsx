import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowDownRight } from "lucide-react";

const WithdrawCard = () => {
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleWithdrawAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWithdrawAmount(parseFloat(e.target.value));
  };

  const handleWithdrawAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWithdrawAddress(e.target.value);
  };

  const handleWithdraw = async () => {
    if (withdrawAmount <= 0 || !withdrawAddress) return;

    try {
      setLoading(true);
      // API call to withdraw funds
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  return (
    <Card className="glass-card overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-defi-pink/5 to-defi-purple/5" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-defi-pink">
          <ArrowDownRight className="h-5 w-5" />
          Quick Withdraw
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Input
            placeholder="Enter withdrawal address"
            value={withdrawAddress}
            onChange={handleWithdrawAddressChange}
            className="border-defi-purple/20 bg-white/50 backdrop-blur-sm"
          />
          <Input
            type="number"
            placeholder="Amount"
            value={withdrawAmount}
            onChange={handleWithdrawAmountChange}
            className="border-defi-purple/20 bg-white/50 backdrop-blur-sm"
          />
          <Button
            className="w-full bg-gradient-to-r from-defi-purple to-defi-pink hover:opacity-90 transition-opacity"
            onClick={handleWithdraw}
            disabled={loading}
          >
            {loading ? "Processing..." : "Withdraw Funds"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default WithdrawCard;