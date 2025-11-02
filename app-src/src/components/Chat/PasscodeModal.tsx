import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface PasscodeModalProps {
  isOpen: boolean;
  documentSlug: string;
  documentTitle: string;
  onClose?: () => void;
}

export function PasscodeModal({ isOpen, documentSlug, documentTitle, onClose }: PasscodeModalProps) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!passcode.trim()) {
      setError('Please enter a passcode');
      return;
    }

    setError(null);
    setValidating(true);

    try {
      // Check access with the provided passcode
      const authHeaders = getAuthHeaders();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(authHeaders.Authorization ? { Authorization: authHeaders.Authorization } : {}),
      };

      const response = await fetch(`/api/permissions/check-access/${documentSlug}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ passcode }),
      });

      const data = await response.json();

      if (data.has_access) {
        // Access granted - store passcode in localStorage
        const passcodeKey = `passcode:${documentSlug}`;
        localStorage.setItem(passcodeKey, passcode);
        console.log(`[PasscodeModal] Stored passcode for ${documentSlug} in localStorage`);
        
        // Use window.location to do a full reload with passcode in URL
        // This ensures everything is in sync and avoids React Router navigation issues
        const newParams = new URLSearchParams(searchParams);
        newParams.set('passcode', passcode);
        const newUrl = `/app/chat?doc=${documentSlug}&${newParams.toString()}`;
        window.location.href = newUrl;
      } else {
        if (data.error_type === 'passcode_incorrect') {
          setError('Incorrect passcode. Please try again.');
        } else {
          setError('Access denied. Please check your passcode.');
        }
        setValidating(false);
      }
    } catch (err) {
      console.error('Passcode validation error:', err);
      setError('Error validating passcode. Please try again.');
      setValidating(false);
    }
  };

  const handleGoBack = () => {
    if (onClose) {
      onClose();
    } else {
      navigate(-1);
    }
  };

  const getAuthHeaders = () => {
    try {
      const sessionKey = 'sb-mlxctdgnojvkgfqldaob-auth-token';
      const sessionData = localStorage.getItem(sessionKey);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        if (session?.access_token) {
          return { 'Authorization': `Bearer ${session.access_token}` };
        }
      }
    } catch (e) {
      // Ignore
    }
    return {};
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Passcode Required</h2>
        
        <div className="mb-6">
          <p className="text-gray-700 mb-2">
            The document <strong className="font-semibold">"{documentTitle}"</strong> requires a passcode to access.
          </p>
          <p className="text-gray-600 text-sm">
            Please enter the passcode:
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <input
              type="password"
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value);
                setError(null);
              }}
              placeholder="Enter passcode"
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                error ? 'border-red-500' : 'border-gray-300'
              }`}
              autoFocus
              disabled={validating}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
            />
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleGoBack}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={validating}
            >
              Go Back
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={validating || !passcode.trim()}
            >
              {validating ? 'Validating...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

