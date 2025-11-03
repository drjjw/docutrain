/**
 * DocutrainFooter - Subtle footer indicating this is a Docutrain article
 * Can be hidden via URL parameter footer=false or dismissed with a cookie
 */

import { useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import { X } from 'lucide-react';
import { docutrainIconUrl } from '@/assets';

const FOOTER_COOKIE_NAME = '_docutrain_footer_dismissed';
const COOKIE_EXPIRY_DAYS = 365; // 1 year

export function DocutrainFooter() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if footer was dismissed via cookie
    const isDismissed = Cookies.get(FOOTER_COOKIE_NAME);
    if (!isDismissed) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    // Set cookie for 365 days
    Cookies.set(FOOTER_COOKIE_NAME, 'true', {
      expires: COOKIE_EXPIRY_DAYS,
      path: '/',
    });
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div 
      className="py-3 px-4 relative"
      style={{
        background: '#ffffff',
        border: '1px solid #e6e6e6'
      }}
    >
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Dismiss footer"
        title="Dismiss footer"
      >
        <X size={16} />
      </button>
      <div className="flex flex-wrap items-center justify-center gap-0.5 sm:gap-1 text-xs text-gray-500 px-2 sm:px-0">
        <img 
          src={docutrainIconUrl}
          alt="DocuTrain"
          className="h-6 w-6 opacity-100 flex-shrink-0"
        />
        <span className="whitespace-nowrap">
          This is a{' '}
          <a 
            href="https://www.docutrain.io/" 
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-gray-900 transition-colors font-medium underline decoration-dotted underline-offset-2"
          >
            DocuTrain
          </a>
          {' '}article chatbot.
        </span>
       
      </div>
    </div>
  );
}
