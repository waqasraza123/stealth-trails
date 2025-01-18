import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { LoadingButton } from "@/components/ui/loading-button";
import { Wallet, Shield, AlertCircle } from "lucide-react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const formSchema = z.object({
  validatorCount: z.number().min(1).max(100),
  rewardRate: z.number().min(1).max(20),
  minStake: z.number().min(0.1),
  maxStake: z.number().min(32),
  description: z.string().min(10).max(500),
});

const CreatePool = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();
  const [progress, setProgress] = useState(0);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      validatorCount: 1,
      rewardRate: 4.8,
      minStake: 0.1,
      maxStake: 32,
      description: "",
    },
  });

  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        setIsConnected(true);
        toast({
          title: "Wallet Connected",
          description: "Your MetaMask wallet has been connected successfully.",
        });
      } catch (error) {
        toast({
          title: "Connection Failed",
          description: "Failed to connect to MetaMask. Please try again.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "MetaMask Not Found",
        description: "Please install MetaMask to continue.",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!isConnected) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet first.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    setProgress(0);
    
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 500);

    setTimeout(() => {
      clearInterval(interval);
      setIsCreating(false);
      setProgress(100);
      toast({
        title: "Pool Created Successfully",
        description: `Created new staking pool with ${values.validatorCount} validators`,
      });
    }, 5000);
  };

  return (
    <Layout>
      <div className="space-y-8 animate-fadeIn">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-apple-blue">
            Create Staking Pool
          </h1>
        </div>

        <Alert className="bg-apple-soft-blue border-apple-blue">
          <Shield className="h-4 w-4" />
          <AlertTitle>Connect Your Wallet</AlertTitle>
          <AlertDescription>
            To create a new staking pool, you'll need to connect your MetaMask wallet first.
          </AlertDescription>
        </Alert>

        <Card className="glass-card p-8 max-w-2xl mx-auto bg-white/30 backdrop-blur-md border border-white/20 shadow-lg">
          <div className="mb-6">
            <Button
              onClick={connectWallet}
              className={`w-full ${isConnected ? 'bg-apple-mint hover:bg-apple-mint/90' : 'bg-apple-blue hover:bg-apple-blue/90'} transition-all duration-300`}
            >
              <Wallet className="mr-2 h-4 w-4" />
              {isConnected ? "Wallet Connected" : "Connect MetaMask"}
            </Button>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="validatorCount"
                render={({ field }) => (
                  <FormItem className="animate-slideIn">
                    <FormLabel>Number of Validators</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        className="border-apple-gray focus:border-apple-blue"
                      />
                    </FormControl>
                    <FormDescription className="text-apple-neutral">
                      Each validator requires 32 ETH
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rewardRate"
                render={({ field }) => (
                  <FormItem className="animate-slideIn">
                    <FormLabel>Expected APR (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        className="border-apple-gray focus:border-apple-blue"
                      />
                    </FormControl>
                    <FormDescription className="text-apple-neutral">
                      Current network average is 4.8%
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="minStake"
                  render={({ field }) => (
                    <FormItem className="animate-slideIn">
                      <FormLabel>Minimum Stake (ETH)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                          className="border-apple-gray focus:border-apple-blue"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxStake"
                  render={({ field }) => (
                    <FormItem className="animate-slideIn">
                      <FormLabel>Maximum Stake (ETH)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                          className="border-apple-gray focus:border-apple-blue"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="animate-slideIn">
                    <FormLabel>Pool Description</FormLabel>
                    <FormControl>
                      <Input 
                        {...field}
                        className="border-apple-gray focus:border-apple-blue"
                      />
                    </FormControl>
                    <FormDescription className="text-apple-neutral">
                      Provide details about the pool's strategy and requirements
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isCreating && (
                <div className="space-y-2 animate-fadeIn">
                  <Progress value={progress} className="h-2 bg-apple-gray" />
                  <p className="text-sm text-apple-neutral text-center">
                    Creating pool... {progress}%
                  </p>
                </div>
              )}

              <LoadingButton
                type="submit"
                className="w-full bg-apple-blue hover:bg-apple-blue/90 transition-all duration-300"
                loading={isCreating}
                disabled={isCreating || !isConnected}
              >
                Create Pool
              </LoadingButton>
            </form>
          </Form>
        </Card>
      </div>
    </Layout>
  );
};

export default CreatePool;