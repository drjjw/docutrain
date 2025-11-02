/**
 * DocutrainFooter - Subtle footer indicating this is a Docutrain article
 * Can be hidden via URL parameter footer=false
 */

import { docutrainIconUrl } from '@/assets';

export function DocutrainFooter() {
  return (
    <div className="border-t border-gray-100 bg-gray-50/50 py-3 px-4">
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
