import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calculator, Info, AlertCircle, Wallet } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { LoanSummary } from "./LoanSummary";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Constants
const ETH_PRICE_USD = 3000;
const REQUIRED_COLLATERAL_RATIO = 1.5;

export const LoanApplicationForm = () => {
  const [loanAmount, setLoanAmount] = useState<string>("");
  const [collateralAmount, setCollateralAmount] = useState<string>("");
  const [loanTerm, setLoanTerm] = useState<string>("30");
  const [walletConnected, setWalletConnected] = useState(false);
  const [approving, setApproving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [userUsdtBalance, setUserUsdtBalance] = useState<string>("0");

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

  const connectWallet = async () => {
    try {
      if (typeof window.ethereum === 'undefined') {
        toast({
          title: "MetaMask Required",
          description: "Please install MetaMask to continue",
          variant: "destructive",
        });
        return;
      }

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts.length > 0) {
        setWalletConnected(true);
        // Simulate getting USDT balance
        setUserUsdtBalance("5000.00");
        toast({
          title: "Wallet Connected",
          description: "Successfully connected to MetaMask",
        });
      }
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Failed to connect wallet. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleApproveCollateral = async () => {
    if (!walletConnected) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    const collateralAmountNum = parseFloat(collateralAmount);
    const userBalanceNum = parseFloat(userUsdtBalance);

    if (collateralAmountNum > userBalanceNum) {
      toast({
        title: "Insufficient Balance",
        description: `You need ${collateralAmount} USDT for collateral. Your balance: ${userUsdtBalance} USDT`,
        variant: "destructive",
      });
      return;
    }

    setApproving(true);
    try {
      // Simulate blockchain delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      setApproving(false);
      toast({
        title: "Collateral Approved",
        description: "Your USDT has been approved for the loan",
      });
      return true;
    } catch (error) {
      setApproving(false);
      toast({
        title: "Approval Failed",
        description: "Failed to approve USDT. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  const handleApply = async () => {
    const loanAmountNum = parseFloat(loanAmount);

    if (!loanAmountNum) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid loan amount",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      // Simulate blockchain delay
      await new Promise(resolve => setTimeout(resolve, 3000));
      toast({
        title: "Loan Created Successfully",
        description: "Your loan has been created on the blockchain",
      });
    } catch (error) {
      toast({
        title: "Transaction Failed",
        description: "Failed to create loan. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>Apply for ETH Loan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {!walletConnected ? (
          <Button 
            onClick={connectWallet}
            className="w-full bg-gradient-to-r from-defi-purple to-defi-blue hover:opacity-90"
          >
            <Wallet className="mr-2 h-4 w-4" />
            Connect Wallet
          </Button>
        ) : (
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
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Current ETH Price: ${ETH_PRICE_USD} USD</span>
                <span>Your USDT Balance: {userUsdtBalance} USDT</span>
              </div>
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

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  className="w-full bg-gradient-to-r from-defi-purple to-defi-blue hover:opacity-90"
                  disabled={!loanAmount || approving || processing}
                >
                  {approving ? "Approving..." : processing ? "Processing..." : "Apply for Loan"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Loan Application</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will require two transactions:
                    1. Approve {collateralAmount} USDT as collateral
                    2. Create the loan contract
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      const approved = await handleApproveCollateral();
                      if (approved) {
                        handleApply();
                      }
                    }}
                  >
                    Continue
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
};