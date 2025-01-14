import { useState } from "react";
import { Link } from "react-router-dom";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/ui/logo";

const SignUp = () => {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate loading
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-mint-50/20 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Logo className="mx-auto mb-8" />
          <h2 className="mt-6 text-3xl font-bold tracking-tight">
            Create your account
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Start your journey with Quantum Bank
          </p>
        </div>
        <div className="glass-card mt-8 p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium" htmlFor="firstName">
                  First name
                </label>
                <Input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  className="mt-2"
                />
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="lastName">
                  Last name
                </label>
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  className="mt-2"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="email">
                Email address
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="password">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="mt-2"
              />
            </div>
            <LoadingButton
              type="submit"
              className="w-full"
              loading={loading}
            >
              Create account
            </LoadingButton>
          </form>
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            to="/auth/sign-in"
            className="text-mint-600 hover:text-mint-500"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SignUp;