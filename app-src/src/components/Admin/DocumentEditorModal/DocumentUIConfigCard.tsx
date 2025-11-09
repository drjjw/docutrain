import React, { useState } from 'react';
import { Toggle } from '@/components/UI/Toggle';
import { Spinner } from '@/components/UI/Spinner';
import { generateAndStoreQuiz, type RegenerationLimitError } from '@/services/quizApi';
import type { DocumentUIConfigCardProps } from './types';
import { debugLog } from '@/utils/debug';

export function DocumentUIConfigCard({
  showDocumentSelector,
  showKeywords,
  showDownloads,
  showReferences,
  showRecentQuestions,
  showCountryFlags,
  showQuizzes,
  quizzesGenerated = false,
  documentSlug,
  onFieldChange,
  isTextUpload = false,
  isSuperAdmin = false
}: DocumentUIConfigCardProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationSuccess, setGenerationSuccess] = useState(false);
  const [regenerationInfo, setRegenerationInfo] = useState<{
    lastGenerated: Date | null;
    nextAllowed: Date | null;
  } | null>(null);

  // Format date for display
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  // Calculate time until next allowed generation
  const getTimeUntilNextAllowed = (nextAllowed: Date) => {
    const now = new Date();
    const diff = nextAllowed.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      return 'soon';
    }
  };

  const handleGenerateQuizzes = async () => {
    if (!documentSlug) {
      setGenerationError('Document slug is required');
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    setGenerationSuccess(false);

    try {
      debugLog('Generating quizzes for document:', documentSlug);
      const result = await generateAndStoreQuiz(documentSlug);
      debugLog('Quiz generation successful:', result);
      
      setGenerationSuccess(true);
      // Update quizzes_generated flag
      onFieldChange('quizzes_generated', true);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setGenerationSuccess(false);
      }, 3000);
    } catch (error) {
      debugLog('Quiz generation error:', error);
      
      // Check if it's a regeneration limit error
      if (error && typeof error === 'object' && 'nextAllowedDate' in error) {
        const limitError = error as RegenerationLimitError;
        setRegenerationInfo({
          lastGenerated: new Date(limitError.lastGenerated),
          nextAllowed: new Date(limitError.nextAllowedDate),
        });
        setGenerationError(limitError.message);
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate quizzes';
        setGenerationError(errorMessage);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h4 className="text-lg font-semibold text-gray-900">UI Configuration</h4>
        </div>
      </div>
      <div className="px-6 py-4 space-y-4">
        <Toggle
          checked={showDocumentSelector || false}
          onChange={(checked) => onFieldChange('show_document_selector', checked)}
          label="Document Selector"
          description="Show a document selection interface in the chat interface"
          size="md"
        />
        <Toggle
          checked={showKeywords !== false}
          onChange={(checked) => onFieldChange('show_keywords', checked)}
          label="Show Keywords Cloud"
          description="Display the keywords cloud in the chat interface"
          size="md"
        />
        <Toggle
          checked={showDownloads !== false}
          onChange={(checked) => onFieldChange('show_downloads', checked)}
          label="Show Downloads Section"
          description="Display the downloads section in the chat interface"
          size="md"
        />
        {isSuperAdmin && (
          <div className="space-y-3">
            {/* Generate Quizzes Section */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h5 className="text-sm font-semibold text-gray-900 mb-1">Quiz Generation</h5>
                  <p className="text-xs text-gray-600">
                    Generate quiz questions for this document. Questions are scaled based on document size (1 per 2 chunks, min 10, max 100).
                    {isSuperAdmin && ' Super admins can regenerate quizzes at any time.'}
                  </p>
                </div>
              </div>
              
              {/* Generate/Regenerate Button */}
              <button
                onClick={handleGenerateQuizzes}
                disabled={isGenerating || !documentSlug}
                className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                  isGenerating || !documentSlug
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isGenerating ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    Generating Quizzes...
                  </span>
                ) : quizzesGenerated ? (
                  'Regenerate Quizzes'
                ) : (
                  'Generate Quizzes'
                )}
              </button>

              {/* Generation Status Messages */}
              {generationSuccess && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800 font-medium">
                    ✓ Quizzes generated successfully! You can now enable the quiz toggle below.
                  </p>
                </div>
              )}

              {generationError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800 font-medium mb-1">{generationError}</p>
                  {regenerationInfo && regenerationInfo.nextAllowed && !isSuperAdmin && (
                    <p className="text-xs text-red-700">
                      Last generated: {formatDate(regenerationInfo.lastGenerated!)}. 
                      Next allowed: {formatDate(regenerationInfo.nextAllowed)} ({getTimeUntilNextAllowed(regenerationInfo.nextAllowed)})
                    </p>
                  )}
                </div>
              )}

              {quizzesGenerated && !generationError && !generationSuccess && regenerationInfo && !isSuperAdmin && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-800">
                    Quizzes can be regenerated once per week. Next allowed: {formatDate(regenerationInfo.nextAllowed!)} ({getTimeUntilNextAllowed(regenerationInfo.nextAllowed!)})
                  </p>
                </div>
              )}
            </div>

            {/* Show Quiz Toggle */}
            <Toggle
              checked={showQuizzes === true}
              onChange={(checked) => onFieldChange('show_quizzes', checked)}
              label="Show Quiz Button"
              description="Display the quiz button next to keywords in the chat interface"
              size="md"
              disabled={!quizzesGenerated}
            />
            {!quizzesGenerated && (
              <p className="text-xs text-gray-500 ml-6">
                Generate quizzes above to enable this option.
              </p>
            )}
          </div>
        )}
        <Toggle
          checked={showReferences !== false}
          onChange={(checked) => onFieldChange('show_references', checked)}
          label="Show References"
          description={isTextUpload 
            ? "References are disabled for text uploads since there are no page numbers in the source material"
            : "Display references section at the end of chat messages"}
          size="md"
          disabled={isTextUpload}
        />
        <Toggle
          checked={showRecentQuestions === true}
          onChange={(checked) => onFieldChange('show_recent_questions', checked)}
          label="Show Recent Questions"
          description="Display a gallery of recent questions asked about this document. Note: The gallery will only appear if there are at least 2 recent questions available."
          size="md"
        />
        {showRecentQuestions && (
          <div className="ml-6 pl-4 border-l-2 border-gray-200">
            <Toggle
              checked={showCountryFlags === true}
              onChange={(checked) => onFieldChange('show_country_flags', checked)}
              label="Show Country Flags"
              description="Display country flags next to recent questions based on the user's IP address location"
              size="md"
            />
          </div>
        )}
        {isTextUpload && (
          <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> This document was uploaded as text. References require page numbers, which are only available for PDF uploads.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

