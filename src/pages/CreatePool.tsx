import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { LoadingButton } from "@/components/ui/loading-button";
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

const formSchema = z.object({
  validatorCount: z.number().min(1).max(100),
  rewardRate: z.number().min(1).max(20),
  minStake: z.number().min(0.1),
  maxStake: z.number().min(32),
  description: z.string().min(10).max(500),
});

const CreatePool = () => {
  const [isCreating, setIsCreating] = useState(false);
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

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsCreating(true);
    setProgress(0);
    
    // Simulate pool creation progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 500);

    // Simulate API call
    setTimeout(() => {
      clearInterval(interval);
      setIsCreating(false);
      setProgress(100);
      toast({
        title: "Pool Created Successfully",
        description: `Created new Ethereum staking pool with ${values.validatorCount} validators`,
      });
    }, 5000);
  };

  return (
    <Layout>
      <div className="space-y-8 animate-in">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-foreground">
            Create Ethereum Staking Pool
          </h1>
        </div>

        <Card className="glass-card p-8 max-w-2xl mx-auto">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="validatorCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Validators</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
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
                  <FormItem>
                    <FormLabel>Expected APR (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
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
                    <FormItem>
                      <FormLabel>Minimum Stake (ETH)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
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
                    <FormItem>
                      <FormLabel>Maximum Stake (ETH)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
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
                  <FormItem>
                    <FormLabel>Pool Description</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>
                      Provide details about the pool's strategy and requirements
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isCreating && (
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                  <p className="text-sm text-muted-foreground text-center">
                    Creating pool... {progress}%
                  </p>
                </div>
              )}

              <LoadingButton
                type="submit"
                className="w-full"
                loading={isCreating}
                disabled={isCreating}
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