import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/ui/logo";
import { toast } from "@/components/ui/use-toast";
import useAuth from "@/hooks/auth/useAuth";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog";
import { X } from "lucide-react";

const SignUp = () => {
  const { signup, loading, error } = useAuth();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(true); // Control Dialog visibility
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await signup(formData);

      if (data.data?.user) {
        setPrivateKey(data.data.user.privateKey);
      }
    } catch (err) {
      toast({
        title: "Sign-up failed",
        description: error || "An error occurred during sign-up. Please try again.",
      });
    }
  };

  const handleAcknowledge = () => {
    setIsAcknowledged(true);
    toast({
      title: "Private key saved",
      description: "You can now sign in to your account.",
    });
    setIsDialogOpen(false); // Close the dialog
    navigate("/auth/sign-in");
  };

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (token) {
      navigate("/");
    }
  }, [navigate]);

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
              <Input
                id="firstName"
                name="firstName"
                type="text"
                required
                className="mt-2"
                placeholder="First Name"
                value={formData.firstName}
                onChange={handleChange}
              />
              <Input
                id="lastName"
                name="lastName"
                type="text"
                required
                className="mt-2"
                placeholder="Last Name"
                value={formData.lastName}
                onChange={handleChange}
              />
            </div>
            <Input
              id="email"
              name="email"
              type="email"
              required
              className="mt-2"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
            />
            <Input
              id="password"
              name="password"
              type="password"
              required
              className="mt-2"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <LoadingButton type="submit" className="w-full" loading={loading}>
              Create account
            </LoadingButton>
          </form>
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/auth/sign-in" className="text-mint-600 hover:text-mint-500">
            Sign in
          </Link>
        </p>
      </div>

      {privateKey && (
        <Dialog open={isDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Your Private Key</DialogTitle>
              <DialogDescription>
              Please copy and securely store your private key.
              This key will not be displayed again, and we do not store it. If you lose access to your private key, you will permanently lose access to your account & assets.
              </DialogDescription>
            </DialogHeader>
            <div className="p-4 bg-gray-100 rounded-md text-sm font-mono overflow-x-auto">
              {privateKey}
            </div>
            <div className="flex items-center space-x-2 mt-4">
              <input
                type="checkbox"
                id="acknowledge"
                className="form-checkbox"
                onChange={() => setIsAcknowledged(!isAcknowledged)}
                checked={isAcknowledged}
              />
              <label htmlFor="acknowledge" className="text-sm">
                I have copied my private key
              </label>
            </div>
            <DialogFooter>
              <button
                disabled={!isAcknowledged}
                onClick={handleAcknowledge}
                className={`w-full py-2 px-4 rounded ${
                  isAcknowledged
                    ? "bg-mint-600 text-white"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                Continue to Sign In
              </button>
            </DialogFooter>
            <DialogClose asChild>
              <button className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus:outline-none">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </button>
            </DialogClose>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default SignUp;
