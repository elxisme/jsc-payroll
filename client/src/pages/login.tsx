import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-nigeria-green to-gov-navy py-6 px-4 sm:py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 sm:h-20 sm:w-20 bg-white rounded-full flex items-center justify-center shadow-lg">
            <Scale className="text-nigeria-green" size={24} />
          </div>
          <h2 className="mt-4 sm:mt-6 text-2xl sm:text-3xl font-bold text-white">Judicial Service Committee</h2>
          <p className="mt-2 text-base sm:text-lg text-green-100">Payroll Management System</p>
        </div>

        <Card className="mt-6 sm:mt-8 shadow-2xl">
          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 focus:ring-nigeria-green focus:border-nigeria-green"
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <Label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 focus:ring-nigeria-green focus:border-nigeria-green"
                  placeholder="Enter your password"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember-me"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  />
                  <Label htmlFor="remember-me" className="text-sm text-gray-700">
                    Remember me
                  </Label>
                </div>

                <div className="text-sm">
                  <Link href="/forgot-password">
                    <a className="text-nigeria-green hover:text-green-600">
                    Forgot password?
                    </a>
                  </Link>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-nigeria-green hover:bg-green-700 text-white"
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

              {/* Test Users Info */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="text-sm font-medium text-blue-800 mb-2">Test Users:</h3>
                <div className="text-xs text-blue-700 space-y-1">
                  <div><strong>Super Admin:</strong> superadmin@jsc.gov.ng / admin123</div>
                  <div><strong>Account Manager:</strong> accounts@jsc.gov.ng / acc123</div>
                  <div><strong>Payroll Manager:</strong> payroll@jsc.gov.ng / pay123</div>
                  <div><strong>Staff:</strong> staff@jsc.gov.ng / staff123</div>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
