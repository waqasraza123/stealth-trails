import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUpRight, ArrowDownRight, ArrowLeftRight, Loader2 } from "lucide-react";
import { useGetUser } from "@/hooks/user/useGetUser";

const Wallet = () => {
  const [selectedAsset, setSelectedAsset] = useState("Ethereum (ETH)");
  const [depositAmount, setDepositAmount] = useState(0);
  const [depositAddress, setDepositAddress] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [loading, setLoading] = useState(false);

  const userId =
      JSON.parse(localStorage.getItem("user") || "{}").supabaseUserId || "";
  const { loading: loadingUser, user } = useGetUser(userId);
  
  useEffect(() => {
    if (user?.ethereumAddress) {
      setDepositAddress(user.ethereumAddress);
    }
  }, [user]);

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
      // await deposit({ asset: selectedAsset, amount: depositAmount, address: depositAddress });
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
    <Layout>
      <div className="space-y-8">
        <h1 className="text-3xl font-semibold text-foreground">Deposit & Withdraw</h1>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpRight className="h-5 w-5 text-mint-600" />
                Quick Deposit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-lg border p-4">
                  <div className="mb-2 text-sm text-muted-foreground">Your Deposit Address</div>
                  <div className="flex items-center justify-between gap-4">
                    <code className="rounded bg-mint-50 px-2 py-1 text-sm">
                    {loadingUser ? <Loader2 className="animate-spin" /> : depositAddress}
                    </code>
                    <Button variant="outline" size="sm">
                      Show QR
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

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
        </div>

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
      </div>
    </Layout>
  );
};

export default Wallet;
