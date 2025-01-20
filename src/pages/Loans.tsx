import { Layout } from "@/components/Layout";
import { ActiveLoans } from "@/components/loans/ActiveLoans";
import { LoanApplicationForm } from "@/components/loans/LoanApplicationForm";

const Loans = () => {
  return (
    <Layout>
      <div className="space-y-8">
        <h1 className="text-3xl font-semibold text-foreground">DeFi Loans</h1>
        <ActiveLoans />
        <LoanApplicationForm />
      </div>
    </Layout>
  );
};

export default Loans;