import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/UI/Button';
import { Card } from '@/components/UI/Card';

export function LogoutPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Auto redirect to login after 3 seconds
    const timer = setTimeout(() => {
      navigate('/login', { replace: true });
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  const handleLoginNow = () => {
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card className="text-center">
          <div className="mb-6">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Successfully Signed Out
            </h2>
            <p className="text-gray-600">
              Thank you for using the Admin Portal. You have been securely signed out of your account.
            </p>
          </div>

          <div className="space-y-4">
            <div className="text-sm text-gray-500">
              You will be automatically redirected to the login page in a few seconds...
            </div>

            <Button
              onClick={handleLoginNow}
              className="w-full"
              size="lg"
            >
              Sign In Again
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
