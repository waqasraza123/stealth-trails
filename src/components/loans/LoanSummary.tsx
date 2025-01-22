import { Calculator } from "lucide-react";

interface LoanSummaryProps {
  loanAmount: string;
  collateralAmount: string;
  loanTerm: string;
}

export const LoanSummary = ({ loanAmount, collateralAmount, loanTerm }: LoanSummaryProps) => {
  const calculateAPR = (collateralRatio: number) => {
    const baseAPR = 12;
    const ratio = collateralRatio - 1.5;
    const reduction = Math.min(ratio * 2, 4);
    return Math.max(baseAPR - reduction, 8);
  };

  const calculateLiquidationPrice = () => {
    if (!loanAmount || !collateralAmount) return 0;
    const loanValue = parseFloat(loanAmount) * 3000; // ETH price
    return (loanValue / (parseFloat(collateralAmount) * 0.8)).toFixed(2);
  };

  return (
    <div className="rounded-lg bg-defi-light-purple/10 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Calculator className="h-4 w-4 text-defi-purple" />
        <span className="text-sm font-medium">Loan Summary</span>
      </div>
      {loanAmount && collateralAmount && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-muted-foreground">Collateral Ratio:</span>
          <span>150%</span>
          <span className="text-muted-foreground">APR:</span>
          <span>{calculateAPR(1.5)}%</span>
          <span className="text-muted-foreground">Liquidation Price:</span>
          <span>${calculateLiquidationPrice()} USD</span>
          <span className="text-muted-foreground">Repayment Amount:</span>
          <span>
            {(parseFloat(loanAmount) * (1 + calculateAPR(1.5) / 100 * parseInt(loanTerm) / 365)).toFixed(4)} ETH
          </span>
        </div>
      )}
    </div>
  );
};