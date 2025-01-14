import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, PiggyBank, Calculator } from "lucide-react";

const Loans = () => {
  return (
    <Layout>
      <div className="space-y-8">
        <h1 className="text-3xl font-semibold text-foreground">Loans & Savings</h1>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PiggyBank className="h-5 w-5 text-mint-600" />
                Savings Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-lg bg-mint-50 p-4">
                  <div className="text-sm text-muted-foreground">Total Savings</div>
                  <div className="text-2xl font-semibold">$12,345.67</div>
                  <div className="mt-1 text-sm text-mint-600">+2.5% APY</div>
                </div>
                <Button className="w-full">Add to Savings</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-mint-600" />
                Active Loans
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground">Current Balance</div>
                  <div className="text-2xl font-semibold">$5,000.00</div>
                  <div className="mt-1 text-sm text-muted-foreground">12% APR</div>
                </div>
                <Button variant="outline" className="w-full">View Details</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="glass-card">
          <Tabs defaultValue="loan" className="p-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="loan">Apply for Loan</TabsTrigger>
              <TabsTrigger value="savings">New Savings</TabsTrigger>
            </TabsList>
            <TabsContent value="loan" className="space-y-4 pt-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Loan Type</label>
                  <select className="w-full rounded-md border bg-transparent px-3 py-2">
                    <option>Personal Loan</option>
                    <option>Business Loan</option>
                    <option>Crypto-backed Loan</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Amount</label>
                  <Input type="number" placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Term (months)</label>
                  <Input type="number" placeholder="12" />
                </div>
                <div className="rounded-lg bg-mint-50 p-4">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-mint-600" />
                    <span className="text-sm font-medium">Estimated Payment</span>
                  </div>
                  <div className="mt-2 text-2xl font-semibold">$450.00/mo</div>
                </div>
                <Button>Apply Now</Button>
              </div>
            </TabsContent>
            <TabsContent value="savings" className="space-y-4 pt-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Initial Deposit</label>
                  <Input type="number" placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Term</label>
                  <select className="w-full rounded-md border bg-transparent px-3 py-2">
                    <option>3 months (2.5% APY)</option>
                    <option>6 months (3.0% APY)</option>
                    <option>12 months (3.5% APY)</option>
                  </select>
                </div>
                <Button>Open Savings Account</Button>
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </Layout>
  );
};

export default Loans;