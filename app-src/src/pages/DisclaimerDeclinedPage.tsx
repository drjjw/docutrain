/**
 * DisclaimerDeclinedPage - Page shown when user declines the disclaimer
 * Public access - no authentication required
 */

import { useNavigate } from 'react-router-dom';
import { PublicHeader } from '@/components/Layout/PublicHeader';
import { PublicFooter } from '@/components/Layout/PublicFooter';
import { Button } from '@/components/UI/Button';
import { AlertCircle } from 'lucide-react';

export function DisclaimerDeclinedPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Public Header */}
      <PublicHeader />

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1 flex items-center">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 w-full">
          <div className="text-center">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-yellow-100 rounded-full">
                <AlertCircle className="w-12 h-12 text-yellow-600" />
              </div>
            </div>

            {/* Message */}
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
              Disclaimer Not Accepted
            </h1>
            
            <p className="text-lg text-gray-700 mb-8">
              Sorry, you can't proceed to view this document without approval. Have a nice day!
            </p>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                variant="primary"
                onClick={() => navigate('/')}
              >
                Return to Home
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(-1)}
              >
                Go Back
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <PublicFooter />
    </div>
  );
}

