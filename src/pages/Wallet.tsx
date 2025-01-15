import { Layout } from "@/components/Layout";
import DepositCard from "./wallet/DepositCard";
import WithdrawCard from "./wallet/WithdrawCard";
import TabsSection from "./wallet/TabsSection";

const Wallet = () => {
  return (
    <Layout>
      <div className="space-y-8">
        <h1 className="text-3xl font-semibold text-foreground">Deposit & Withdraw</h1>

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
