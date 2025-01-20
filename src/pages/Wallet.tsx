import { Layout } from "@/components/Layout";
import DepositCard from "./wallet/DepositCard";
import WithdrawCard from "./wallet/WithdrawCard";
import TabsSection from "./wallet/TabsSection";
import { Coins } from "lucide-react";

const Wallet = () => {
  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center gap-3 mb-8">
          <Coins className="w-8 h-8 text-defi-purple" />
          <h1 className="text-3xl font-semibold bg-gradient-to-r from-defi-purple to-defi-blue bg-clip-text text-transparent">
            Deposit & Withdraw
          </h1>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <DepositCard />
          <WithdrawCard />
        </div>
        <TabsSection />
      </div>
    </Layout>
  );
};

export default Wallet;