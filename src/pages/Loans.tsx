import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Calculator, Info, AlertCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState } from "react";
import { toast } from "@/components/ui/use-toast";

const Loans = () => {
  const [loanAmount, setLoanAmount] = useState<string>("");
  const [collateralAmount, setCollateralAmount] = useState<string>("");
  const [loanTerm, setLoanTerm] = useState<string>("30");
  const [loanType, setLoanType] = useState<string>("ETH");

  const calculateMinCollateral = (amount: number) => {
    // Typically DeFi loans require 150% collateralization
    return amount * 1.5;
  };

  const calculateAPR = (collateralRatio: number) => {
    // Base APR is 12%, decreases with higher collateral ratio
    const baseAPR = 12;
    const ratio = collateralRatio - 1.5; // Subtract minimum ratio
    const reduction = Math.min(ratio * 2, 4); // Max 4% reduction
    return Math.max(baseAPR - reduction, 8); // Minimum 8% APR
  };

  const handleApply = () => {
    const loanAmountNum = parseFloat(loanAmount);
    const collateralAmountNum = parseFloat(collateralAmount);

    if (!loanAmountNum || !collateralAmountNum) {
      toast({
        title: "Validation Error",
        description: "Please enter valid loan and collateral amounts",
        variant: "destructive",
      });
      return;
    }

    const minCollateral = calculateMinCollateral(loanAmountNum);
    if (collateralAmountNum < minCollateral) {
      toast({
        title: "Insufficient Collateral",
        description: `Minimum collateral required: ${minCollateral} ${loanType}`,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Loan Application Submitted",
      description: "Your loan request is being processed on the blockchain",
    });
  };

  return (
    <Layout>
      <div className="space-y-8">
        <h1 className="text-3xl font-semibold text-foreground">DeFi Loans</h1>

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

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Apply for a Loan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  Asset Type
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Select the asset you want to borrow</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </label>
                <select 
                  className="w-full rounded-md border bg-transparent px-3 py-2"
                  value={loanType}
                  onChange={(e) => setLoanType(e.target.value)}
                >
                  <option value="ETH">Ethereum (ETH)</option>
                  <option value="USDC">USD Coin (USDC)</option>
                  <option value="DAI">DAI Stablecoin</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  Loan Amount
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Amount you want to borrow in {loanType}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </label>
                <Input 
                  type="number" 
                  placeholder="0.00"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  Collateral Amount
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <AlertCircle className="h-4 w-4 text-defi-orange" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Minimum 150% of loan amount required</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </label>
                <Input 
                  type="number" 
                  placeholder="0.00"
                  value={collateralAmount}
                  onChange={(e) => setCollateralAmount(e.target.value)}
                />
                {loanAmount && (
                  <p className="text-sm text-muted-foreground">
                    Minimum required: {calculateMinCollateral(parseFloat(loanAmount))} {loanType}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Loan Term (days)</label>
                <select 
                  className="w-full rounded-md border bg-transparent px-3 py-2"
                  value={loanTerm}
                  onChange={(e) => setLoanTerm(e.target.value)}
                >
                  <option value="30">30 days</option>
                  <option value="60">60 days</option>
                  <option value="90">90 days</option>
                </select>
              </div>

              <div className="rounded-lg bg-defi-light-purple/10 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-defi-purple" />
                  <span className="text-sm font-medium">Loan Summary</span>
                </div>
                {loanAmount && collateralAmount && (
                  <>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">Collateral Ratio:</span>
                      <span>{((parseFloat(collateralAmount) / parseFloat(loanAmount)) * 100).toFixed(0)}%</span>
                      <span className="text-muted-foreground">APR:</span>
                      <span>{calculateAPR(parseFloat(collateralAmount) / parseFloat(loanAmount))}%</span>
                      <span className="text-muted-foreground">Repayment Amount:</span>
                      <span>{(parseFloat(loanAmount) * (1 + calculateAPR(parseFloat(collateralAmount) / parseFloat(loanAmount)) / 100 * parseInt(loanTerm) / 365)).toFixed(4)} {loanType}</span>
                    </div>
                  </>
                )}
              </div>

              <Button 
                onClick={handleApply}
                className="w-full bg-gradient-to-r from-defi-purple to-defi-blue hover:opacity-90"
              >
                Apply for Loan
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Loans;