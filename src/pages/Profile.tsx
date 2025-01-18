import React, { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bell, Shield, Wallet, LogOut, Loader2, Upload, Link } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useGetUser } from "@/hooks/user/useGetUser";
import { useToast } from "@/hooks/use-toast";

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const userId = JSON.parse(localStorage.getItem("user") || "{}").supabaseUserId || "";
  const { user, loading, error } = useGetUser(userId);

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    navigate("/auth/sign-in");
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    // Simulated upload delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    setUploading(false);
    
    toast({
      title: "Profile picture updated",
      description: "Your new profile picture has been uploaded successfully.",
    });
  };

  const connectMetaMask = async () => {
    setConnecting(true);
    try {
      if (typeof window.ethereum === 'undefined') {
        toast({
          variant: "destructive",
          title: "MetaMask not found",
          description: "Please install MetaMask to connect your wallet.",
        });
        return;
      }

      await window.ethereum.request({ method: 'eth_requestAccounts' });
      toast({
        title: "Wallet connected",
        description: "Your MetaMask wallet has been linked successfully.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Connection failed",
        description: "Failed to connect to MetaMask. Please try again.",
      });
    } finally {
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-mint-600" />
      </div>
    );
  }

  if (error) {
    handleLogout();
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center gap-6">
          <div className="relative group">
            <Avatar className="h-24 w-24 transition-all duration-300 group-hover:opacity-75">
              <AvatarImage src={user?.avatarUrl || "https://github.com/shadcn.png"} />
              <AvatarFallback>
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <label 
              className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 cursor-pointer rounded-full transition-all duration-300"
              htmlFor="avatar-upload"
            >
              <Upload className="h-6 w-6 text-white" />
            </label>
            <input
              type="file"
              id="avatar-upload"
              className="hidden"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={uploading}
            />
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-foreground">
              {user?.firstName ?? "John"} {user?.lastName ?? "Doe"}
            </h1>
            <p className="text-muted-foreground">{user?.email ?? "john.doe@example.com"}</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-mint-600" />
                Ethereum Wallet
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {user?.ethereumAddress ? (
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Connected Wallet</div>
                      <code className="text-sm text-muted-foreground">
                        {user.ethereumAddress}
                      </code>
                    </div>
                    <Button variant="outline" size="sm">Disconnect</Button>
                  </div>
                </div>
              ) : (
                <Button 
                  className="w-full" 
                  onClick={connectMetaMask}
                  disabled={connecting}
                >
                  {connecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Link className="mr-2 h-4 w-4" />
                      Connect MetaMask
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-mint-600" />
                Security Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Current Password</label>
                <Input type="password" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">New Password</label>
                <Input type="password" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Confirm New Password</label>
                <Input type="password" />
              </div>
              <Button className="w-full">Update Password</Button>
            </CardContent>
          </Card>

          <Card className="glass-card md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-mint-600" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <div className="font-medium">Email Notifications</div>
                    <div className="text-sm text-muted-foreground">
                      Receive updates about your account activity
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Configure</Button>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <div className="font-medium">SMS Alerts</div>
                    <div className="text-sm text-muted-foreground">
                      Get notified about important security events
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Configure</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button variant="destructive" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;
