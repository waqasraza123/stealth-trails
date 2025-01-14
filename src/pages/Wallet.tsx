import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

const Wallet = () => {
  const [selectedAsset, setSelectedAsset] = useState("Bitcoin (BTC)");
  const [depositAmount, setDepositAmount] = useState(0);
  const [depositAddress, setDepositAddress] = useState("0x1234...5678"); // Example address
  //const { deposit, loading } = useApi(); // Assuming you have a useApi hook to handle the API calls

  const handleDepositAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDepositAmount(parseFloat(e.target.value));
  };

  const handleDeposit = async () => {
    if (depositAmount <= 0) {
      // Show error message for invalid amount
      return;
    }

    try {
      //await deposit({ asset: selectedAsset, amount: depositAmount, address: depositAddress });
      // Success message or redirect
    } catch (err) {
      // Handle any errors
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
                      {depositAddress}
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
                <Input placeholder="Enter withdrawal address" />
                <Input type="number" placeholder="Amount" />
                <Button className="w-full">Withdraw Funds</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="glass-card">
          <Tabs defaultValue="deposit" className="p-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="deposit">Deposit</TabsTrigger>
              <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
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
                    <option>Bitcoin (BTC)</option>
                    <option>Ethereum (ETH)</option>
                    <option>USD Coin (USDC)</option>
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
                <Button onClick={handleDeposit} disabled={true}>
                  Continue Deposit
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="withdraw" className="space-y-4 pt-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Asset</label>
                  <select className="w-full rounded-md border bg-transparent px-3 py-2">
                    <option>Bitcoin (BTC)</option>
                    <option>Ethereum (ETH)</option>
                    <option>USD Coin (USDC)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Withdrawal Address</label>
                  <Input placeholder="Enter address" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Amount</label>
                  <Input type="number" placeholder="0.00" />
                </div>
                <Button>Continue Withdrawal</Button>
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </Layout>
  );
};

export default Wallet;
