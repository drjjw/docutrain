import { useState, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAuthHeaders } from '@/lib/api/authService';
import { DocumentAccessContext } from '@/contexts/DocumentAccessContext';

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

  // Get document access context for refreshing after successful validation
  const documentContext = useContext(DocumentAccessContext);

  // Force close modal if context no longer requires passcode
  const stillRequiresPasscode = documentContext?.errorDetails?.type === 'passcode_required';
  const shouldBeOpen = isOpen && stillRequiresPasscode;

  if (!shouldBeOpen) return null;

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
      const headers = getAuthHeaders();

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

        // Dispatch passcode-stored event for other components to refresh
        window.dispatchEvent(new CustomEvent('passcode-stored', {
          detail: { documentSlug }
        }));

        // Update URL with passcode (without full page reload)
        const newParams = new URLSearchParams(searchParams);
        newParams.set('doc', documentSlug); // Ensure doc param is set
        newParams.set('passcode', passcode);

        // Use React Router navigation instead of window.location for smoother UX
        navigate(`?${newParams.toString()}`, { replace: true });

        // Refresh document context to load the document config now that we have access
        if (documentContext?.refresh) {
          documentContext.refresh();
        }

        // Close modal via callback if provided
        if (onClose) {
          onClose();
        }
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

  return (
    <div className="fixed inset-0 z-[9999] flex items-start md:items-center justify-center bg-black bg-opacity-50 p-0 md:p-4">
      <div className="bg-white shadow-xl w-full h-full md:rounded-lg md:max-w-md md:w-full md:h-auto md:mx-4 p-4 md:p-6 flex flex-col">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">Passcode Required</h2>
        
        <div className="mb-6 flex-1 overflow-y-auto min-h-0">
          <p className="text-gray-700 mb-2">
            The document <strong className="font-semibold">"{documentTitle}"</strong> requires a passcode to access.
          </p>
          <p className="text-gray-600 text-sm">
            Please enter the passcode:
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex-shrink-0">
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
              className="flex-1 md:flex-none px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={validating}
            >
              Go Back
            </button>
            <button
              type="submit"
              className="flex-1 md:flex-none px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

