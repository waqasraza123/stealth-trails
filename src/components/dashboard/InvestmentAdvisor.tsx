import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Brain, Sparkles, TrendingUp } from "lucide-react";

interface PoolRecommendation {
  poolId: number;
  confidence: number;
  reason: string;
}

export const InvestmentAdvisor = () => {
  const [amount, setAmount] = useState("");
  const [riskTolerance, setRiskTolerance] = useState([50]);
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<PoolRecommendation | null>(null);
  const { toast } = useToast();

  const getRecommendation = async () => {
    setLoading(true);
    try {
      // Simulate AI recommendation
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setRecommendation({
        poolId: 1,
        confidence: 85,
        reason: "Based on your risk tolerance and investment amount, Pool #1 offers the best balance of rewards and security. The pool has a consistent performance history and aligns with your investment goals.",
      });
      toast({
        title: "Analysis Complete",
        description: "We've found the best pool for your investment profile.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate recommendation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="glass-card overflow-hidden p-6 animate-in">
      <div className="flex items-center gap-2 mb-6">
        <Brain className="w-6 h-6 text-apple-purple" />
        <h2 className="text-xl font-semibold">AI Investment Advisor</h2>
      </div>

      <div className="space-y-6">
        <div>
          <label className="text-sm text-muted-foreground mb-2 block">
            Investment Amount (ETH)
          </label>
          <Input
            type="number"
            placeholder="Enter amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bg-apple-gray/50"
          />
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-2 block">
            Risk Tolerance
          </label>
          <Slider
            value={riskTolerance}
            onValueChange={setRiskTolerance}
            max={100}
            step={1}
            className="my-4"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Conservative</span>
            <span>Aggressive</span>
          </div>
        </div>

        <Button
          onClick={getRecommendation}
          disabled={!amount || loading}
          className="w-full bg-apple-blue hover:bg-apple-blue/90"
        >
          {loading ? (
            "Analyzing..."
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Get Personalized Recommendation
            </>
          )}
        </Button>

        {recommendation && (
          <div className="mt-6 p-4 bg-apple-gray/30 rounded-lg animate-fade-in">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-apple-mint" />
              <h3 className="font-medium">Recommended Pool #{recommendation.poolId}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {recommendation.reason}
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Confidence Score</span>
              <span className="font-medium text-apple-blue">
                {recommendation.confidence}%
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};