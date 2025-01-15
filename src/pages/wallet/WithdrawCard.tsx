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
      // API call for withdrawal
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowDownRight className="h-5 w-5 text-destructive" />
          Quick Withdraw
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Input
            placeholder="Enter withdrawal address"
            value={withdrawAddress}
            onChange={handleWithdrawAddressChange}
          />
          <Input
            type="number"
            placeholder="Amount"
            value={withdrawAmount}
            onChange={handleWithdrawAmountChange}
          />
          <Button
            className="w-full"
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
