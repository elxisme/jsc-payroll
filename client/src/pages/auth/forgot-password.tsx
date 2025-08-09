import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import { Scale, Loader2, ArrowLeft, Mail, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { sendPasswordResetEmail } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await sendPasswordResetEmail(email);
      setIsSuccess(true);
    } catch (error) {
      // Error is handled in useAuth hook, which should display a toast
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-nigeria-green to-gov-navy py-6 px-4 sm:py-12 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-6 sm:space-y-8">
          {/* This block was causing a visual distraction and was removed for a cleaner success message below */}
          {/* 
            <div className="mx-auto h-16 w-16 sm:h-20 sm:w-20 bg-white rounded-full flex items-center justify-center shadow-lg">
              <CheckCircle className="text-nigeria-green" size={24} />
            </div>
            <h2 className="mt-4 sm:mt-6 text-2xl sm:text-3xl font-bold text-white">Check Your Email</h2>
            <p className="mt-2 text-base sm:text-lg text-green-100">Password reset instructions sent</p>
          */}

          <Card className="mt-6 sm:mt-8 shadow-2xl">
            <CardContent className="p-6 sm:p-8">
              <div className="text-center space-y-4">
                <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <Mail className="text-nigeria-green" size={24} />
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Password Reset Email Sent
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    We've sent password reset instructions to:
                  </p>
                  <p className="font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">
                    {email}
                  </p>
                </div>

                <div className="text-left bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Next Steps:</h4>
                  <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Check your email inbox (and spam folder).</li>
                    <li>Click the password reset link in the email.</li>
                    <li>Create a new secure password.</li>
                    <li>Return to login with your new password.</li>
                  </ol>
                </div>

                <div className="pt-4">
                  <Link href="/">
                    <Button variant="outline" className="w-full">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Login
                    </Button>
                  </Link>
                </div>

                <div className="text-center">
                  <p className="text-xs text-gray-500">
                    Didn't receive the email?{' '}
                    <button
                      onClick={() => {
                        setIsSuccess(false);
                        setEmail('');
                      }}
                      className="text-nigeria-green hover:text-green-600 underline"
                    >
                      Try again
                    </button>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-nigeria-green to-gov-navy py-6 px-4 sm:py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 sm:h-20 sm:w-20 bg-white rounded-full flex items-center justify-center shadow-lg">
            <Scale className="text-nigeria-green" size={24} />
          </div>
          <h2 className="mt-4 sm:mt-6 text-2xl sm:text-3xl font-bold text-white">Reset Password</h2>
          <p className="mt-2 text-base sm:text-lg text-green-100">Enter your email to receive reset instructions</p>
        </div>

        <Card className="mt-6 sm:mt-8 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-center">Forgot Your Password?</CardTitle>
          </CardHeader>
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
                  placeholder="Enter your JSC email address"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Enter the email address associated with your JSC account.
                </p>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-nigeria-green hover:bg-green-700 text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending Reset Email...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Reset Instructions
                  </>
                )}
              </Button>

              <div className="text-center">
                <Link href="/">
                  <Button variant="ghost" className="text-sm text-gray-600 hover:text-gray-900">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Login
                  </Button>
                </Link>
              </div>
            </form>

            {/* Help Section */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-800 mb-2">Need Help?</h3>
              <div className="text-xs text-gray-600 space-y-1">
                <p>• Use your official JSC email address.</p>
                <p>• Check your spam/junk folder if you don't see the email.</p>
                <p>• Contact your system administrator if you continue having issues.</p>
                <p>• The reset link will expire in 1 hour for security.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
