import React, { useState } from 'react';
import { Spinner } from '@/components/UI/Spinner';
import { generateAndStoreQuiz, type RegenerationLimitError } from '@/services/quizApi';
import { debugLog } from '@/utils/debug';

interface QuizGenerationSectionProps {
  documentSlug: string;
  quizzesGenerated: boolean;
  isSuperAdmin: boolean;
  onGenerationSuccess: () => void;
}

export function QuizGenerationSection({
  documentSlug,
  quizzesGenerated,
  isSuperAdmin,
  onGenerationSuccess
}: QuizGenerationSectionProps) {
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

  const handleGenerateQuestions = async () => {
    if (!documentSlug) {
      setGenerationError('Document slug is required');
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    setGenerationSuccess(false);

    try {
      debugLog('Generating quiz questions for document:', documentSlug);
      const result = await generateAndStoreQuiz(documentSlug);
      debugLog('Quiz generation successful:', result);
      
      setGenerationSuccess(true);
      onGenerationSuccess();
      
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
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate quiz questions';
        setGenerationError(errorMessage);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h4 className="text-lg font-semibold text-gray-900">Generate Quiz Questions</h4>
          </div>
        </div>
        <div className="px-6 py-4">
          <div className="mb-4">
            <p className="text-sm text-gray-700 mb-2">
              Generate quiz questions for this document. Questions are automatically scaled based on document size (1 per 2 chunks, min 10, max 100).
            </p>
            {isSuperAdmin && (
              <p className="text-xs text-gray-600">
                Super admins can regenerate questions at any time.
              </p>
            )}
          </div>
          
          {/* Generate/Regenerate Button */}
          <button
            onClick={handleGenerateQuestions}
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
                Generating Questions...
              </span>
            ) : quizzesGenerated ? (
              'Regenerate Questions'
            ) : (
              'Generate Questions'
            )}
          </button>

          {/* Generation Status Messages */}
          {generationSuccess && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800 font-medium">
                ✓ Questions generated successfully! They will appear below once the page refreshes.
              </p>
            </div>
          )}

          {generationError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
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
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800">
                Questions can be regenerated once per week. Next allowed: {formatDate(regenerationInfo.nextAllowed!)} ({getTimeUntilNextAllowed(regenerationInfo.nextAllowed!)})
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

