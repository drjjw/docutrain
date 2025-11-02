/**
 * DocutrainFooter - Subtle footer indicating this is a Docutrain article
 * Can be hidden via URL parameter footer=false
 */

import { docutrainIconUrl } from '@/assets';

export function DocutrainFooter() {
  return (
    <div className="border-t border-gray-100 bg-gray-50/50 py-3 px-4">
      <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
        <img 
          src={docutrainIconUrl}
          alt="DocuTrain"
          className="h-4 w-4 opacity-70"
        />
        <span>This is a</span>
        <a 
          href="https://www.docutrain.io/" 
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-600 hover:text-gray-900 transition-colors font-medium underline decoration-dotted underline-offset-2"
        >
          DocuTrain
        </a>
        <span>article. Powered by AI-powered document chat.</span>
      </div>
    </div>
  );
}
