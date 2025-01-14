import { Building2 } from "lucide-react";

export const Logo = ({ className }: { className?: string }) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Building2 className="h-6 w-6 text-mint-500" />
      <span className="text-xl font-semibold tracking-tight">Quantum Bank</span>
    </div>
  );
};