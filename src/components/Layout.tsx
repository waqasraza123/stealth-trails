import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, History, Wallet, User, BarChart3 } from "lucide-react";
import { Logo } from "@/components/ui/logo";

const navItems = [
  { icon: Home, label: "Dashboard", path: "/" },
  { icon: History, label: "Transactions", path: "/transactions" },
  { icon: Wallet, label: "Deposit/Withdraw", path: "/wallet" },
  { icon: BarChart3, label: "Analytics", path: "/analytics" },
  { icon: User, label: "Profile", path: "/profile" },
];

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-mint-50/20">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <nav className="fixed h-screen w-64 border-r border-border bg-background/50 backdrop-blur-xl">
          <div className="flex h-full flex-col">
            <div className="p-6">
              <Logo />
            </div>
            <div className="flex-1 space-y-1 p-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center space-x-3 rounded-lg px-4 py-3 transition-colors ${
                      isActive
                        ? "bg-mint-100 text-mint-700"
                        : "text-muted-foreground hover:bg-mint-50 hover:text-mint-600"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 pl-64">
          <div className="container mx-auto p-8">
            <div className="animate-in">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
};