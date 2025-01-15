import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useState } from "react";

const TabsSection = () => {


const [selectedAsset, setSelectedAsset] = useState("Ethereum (ETH)");
  const [depositAmount, setDepositAmount] = useState(0);
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleDepositAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDepositAmount(parseFloat(e.target.value));
  };

  const handleWithdrawAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWithdrawAmount(parseFloat(e.target.value));
  };

  const handleWithdrawAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWithdrawAddress(e.target.value);
  };

  const handleDeposit = async () => {
    if (depositAmount <= 0) return;

    try {
      setLoading(true);
      // API call to deposit funds
      //await deposit({ asset: selectedAsset, amount: depositAmount, address: depositAddress });
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (withdrawAmount <= 0 || !withdrawAddress) return;

    try {
      setLoading(true);
      // API call to withdraw funds
      // await withdraw({ asset: selectedAsset, amount: withdrawAmount, address: withdrawAddress });
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  return (
    <Card className="glass-card">
      <Tabs defaultValue="deposit" className="p-6">
        <TabsList className="flex gap-4 w-full justify-start">
          <TabsTrigger value="deposit">Deposit</TabsTrigger>
          <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
          <TabsTrigger value="transfer">Transfer</TabsTrigger>
        </TabsList>
        <TabsContent value="deposit" className="space-y-4 pt-4">
          <div className="grid gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Asset</label>
              <select
                className="w-full rounded-md border bg-transparent px-3 py-2"
                value={selectedAsset}
                onChange={(e) => setSelectedAsset(e.target.value)}
              >
                <option>Ethereum (ETH)</option>
                <option>USD Coin (USDC)</option>
                <option>USDT</option>
                <option>Solana (SOL)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount</label>
              <Input
                type="number"
                placeholder="0.00"
                value={depositAmount}
                onChange={handleDepositAmountChange}
              />
            </div>
            <Button
              onClick={handleDeposit}
              disabled={loading || depositAmount <= 0}
            >
              {loading ? "Processing..." : "Continue Deposit"}
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="withdraw" className="space-y-4 pt-4">
          <div className="grid gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Asset</label>
              <select
                className="w-full rounded-md border bg-transparent px-3 py-2"
                value={selectedAsset}
                onChange={(e) => setSelectedAsset(e.target.value)}
              >
                <option>Ethereum (ETH)</option>
                <option>USD Coin (USDC)</option>
                <option>USDT</option>
                <option>Solana (SOL)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Withdrawal Address</label>
              <Input
                placeholder="Enter address"
                value={withdrawAddress}
                onChange={handleWithdrawAddressChange}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount</label>
              <Input
                type="number"
                placeholder="0.00"
                value={withdrawAmount}
                onChange={handleWithdrawAmountChange}
              />
            </div>
            <Button
              onClick={handleWithdraw}
              disabled={loading || withdrawAmount <= 0}
            >
              {loading ? "Processing..." : "Continue Withdrawal"}
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="transfer" className="space-y-4 pt-4">
          <div className="grid gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Asset</label>
              <select
                className="w-full rounded-md border bg-transparent px-3 py-2"
                value={selectedAsset}
                onChange={(e) => setSelectedAsset(e.target.value)}
              >
                <option>Ethereum (ETH)</option>
                <option>USD Coin (USDC)</option>
                <option>USDT</option>
                <option>Solana (SOL)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Receiver Address</label>
              <Input placeholder="Enter receiver address" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount</label>
              <Input type="number" placeholder="0.00" />
            </div>
            <Button
              onClick={handleWithdraw}
              disabled={loading || withdrawAmount <= 0}
            >
              {loading ? "Processing..." : "Transfer Funds"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default TabsSection;
