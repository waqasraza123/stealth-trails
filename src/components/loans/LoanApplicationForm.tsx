import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calculator, Info, AlertCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/components/ui/use-toast";
import { LoanSummary } from "./LoanSummary";

// Constants
const ETH_PRICE_USD = 3000;
const REQUIRED_COLLATERAL_RATIO = 1.5;

export const LoanApplicationForm = () => {
  const [loanAmount, setLoanAmount] = useState<string>("");
  const [collateralAmount, setCollateralAmount] = useState<string>("");
  const [loanTerm, setLoanTerm] = useState<string>("30");

  useEffect(() => {
    if (loanAmount) {
      const ethAmount = parseFloat(loanAmount);
      const ethValueInUSD = ethAmount * ETH_PRICE_USD;
      const requiredCollateral = (ethValueInUSD * REQUIRED_COLLATERAL_RATIO).toFixed(2);
      setCollateralAmount(requiredCollateral);
    } else {
      setCollateralAmount("");
    }
  }, [loanAmount]);

  const handleApply = () => {
    const loanAmountNum = parseFloat(loanAmount);

    if (!loanAmountNum) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid loan amount",
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
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>Apply for ETH Loan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              Loan Amount (ETH)
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Enter the amount of ETH you want to borrow</p>
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
              Required Collateral (USDT)
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <AlertCircle className="h-4 w-4 text-defi-orange" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Required USDT collateral based on current ETH price</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </label>
            <Input 
              type="text" 
              value={collateralAmount ? `${collateralAmount} USDT` : ""}
              disabled
              className="bg-gray-100"
            />
            <p className="text-sm text-muted-foreground">
              Current ETH Price: ${ETH_PRICE_USD} USD
            </p>
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

          <LoanSummary 
            loanAmount={loanAmount} 
            collateralAmount={collateralAmount} 
            loanTerm={loanTerm}
          />

          <Button 
            onClick={handleApply}
            className="w-full bg-gradient-to-r from-defi-purple to-defi-blue hover:opacity-90"
          >
            Apply for Loan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};