import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import { Scale, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: "Error",
        description: "Please enter both email and password",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await signIn(email, password);
    } catch (error) {
      // Error is handled in useAuth hook
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // Use a flex container that takes the full screen height and centers content
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-nigeria-green to-gov-navy p-4">
      
      {/* Main container for the login form and header */}
      <div className="w-full max-w-md space-y-6">
        
        {/* Header Section */}
        <div className="text-center space-y-4">
          <div className="mx-auto h-16 w-16 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg">
            <Scale className="text-nigeria-green h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              JSC Payroll System
            </h1>
            <p className="mt-1 text-base text-green-100">
              Login to your account
            </p>
          </div>
        </div>

        {/* Card for the form */}
        <Card className="shadow-2xl">
          <CardHeader>
            <CardTitle>Welcome Back</CardTitle>
            <CardDescription>Enter your credentials to access your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                />
              </div>

              <div className="space-y-2">
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember-me"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  />
                  <Label htmlFor="remember-me" className="cursor-pointer">
                    Remember me
                  </Label>
                </div>
                <Link href="/forgot-password">
                  <a className="font-medium text-nigeria-green hover:text-green-600 hover:underline">
                    Forgot password?
                  </a>
                </Link>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-nigeria-green hover:bg-green-700"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
            
            {/* Test Users Info */}
            <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-800 mb-2">Test Users:</h3>
              <div className="text-xs text-blue-700 space-y-1.5">
                <p><strong>Super Admin:</strong> superadmin@jsc.gov.ng / admin123</p>
                <p><strong>Account Manager:</strong> accounts@jsc.gov.ng / acc123</p>
                <p><strong>Payroll Manager:</strong> payroll@jsc.gov.ng / pay123</p>
                <p><strong>Staff:</strong> staff@jsc.gov.ng / staff123</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <footer className="text-center text-sm text-green-200">
          &copy; {new Date().getFullYear()} Judicial Service Committee. All Rights Reserved.
        </footer>
      </div>
    </div>
  );
}
