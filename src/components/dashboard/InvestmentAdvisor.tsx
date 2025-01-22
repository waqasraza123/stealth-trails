import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Brain, Sparkles, TrendingUp, AlertCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const formSchema = z.object({
  amount: z.string().min(1, "Investment amount is required")
    .refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: "Amount must be greater than 0",
    }),
  riskTolerance: z.array(z.number())
    .min(1, "Risk tolerance is required")
    .refine(val => val[0] >= 0 && val[0] <= 100, {
      message: "Risk tolerance must be between 0 and 100",
    }),
});

interface PoolRecommendation {
  poolId: number;
  confidence: number;
  reason: string;
}

export const InvestmentAdvisor = () => {
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<PoolRecommendation | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: "",
      riskTolerance: [50],
    },
  });

  const getRecommendation = async (values: z.infer<typeof formSchema>) => {
    setLoading(true);
    try {
      // Simulate AI recommendation
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      const recommendationData = {
        poolId: Math.floor(Math.random() * 3) + 1,
        confidence: Math.floor(Math.random() * 20) + 80,
        reason: `Based on your ${values.riskTolerance[0]}% risk tolerance and ${values.amount} ETH investment amount, Pool #${Math.floor(Math.random() * 3) + 1} offers the best balance of rewards and security. The pool has a consistent performance history and aligns with your investment goals.`,
      };
      
      setRecommendation(recommendationData);
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
      console.error("Recommendation error:", error);
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

      <Form {...form}>
        <form onSubmit={form.handleSubmit(getRecommendation)} className="space-y-6">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm text-muted-foreground">
                  Investment Amount (ETH)
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="Enter amount"
                    {...field}
                    className="bg-apple-gray/50"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="riskTolerance"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm text-muted-foreground">
                  Risk Tolerance
                </FormLabel>
                <FormControl>
                  <Slider
                    value={field.value}
                    onValueChange={field.onChange}
                    max={100}
                    step={1}
                    className="my-4"
                  />
                </FormControl>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Conservative</span>
                  <span>Aggressive</span>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={loading}
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
        </form>
      </Form>

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
    </Card>
  );
};