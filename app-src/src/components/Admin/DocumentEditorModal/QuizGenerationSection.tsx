import React, { useState, useEffect } from 'react';
import { Spinner } from '@/components/UI/Spinner';
import { generateAndStoreQuiz, type RegenerationLimitError, type GenerateAndStoreResponse } from '@/services/quizApi';
import { useQuizGenerationStatus } from '@/hooks/useQuizGenerationStatus';
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
  const [generationData, setGenerationData] = useState<GenerateAndStoreResponse | null>(null);
  const [regenerationInfo, setRegenerationInfo] = useState<{
    lastGenerated: Date | null;
    nextAllowed: Date | null;
  } | null>(null);

  // Subscribe to realtime quiz generation status (works across browser sessions)
  const realtimeStatus = useQuizGenerationStatus(documentSlug);

  // Sync realtime status with local state
  useEffect(() => {
    if (realtimeStatus.isGenerating) {
      setIsGenerating(true);
      setGenerationError(null);
      setGenerationSuccess(false);
    } else if (realtimeStatus.completed) {
      setIsGenerating(false);
      // Don't set success here - wait for API response or refresh
      // The component will refresh when quizzes_generated flag updates
    } else if (realtimeStatus.failed) {
      setIsGenerating(false);
      setGenerationError(realtimeStatus.message || 'Quiz generation failed');
    }
  }, [realtimeStatus]);

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
    setGenerationData(null);

    try {
      debugLog('Generating quiz questions for document:', documentSlug);
      const result = await generateAndStoreQuiz(documentSlug);
      debugLog('Quiz generation successful:', result);
      
      setGenerationData(result);
      setGenerationSuccess(true);
      onGenerationSuccess();
      
      // Don't clear success message automatically - let user see the data
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-900">Quiz Questions</h4>
                <p className="text-xs text-gray-600 mt-0.5">
                  Generate questions based on document size (1 per 2 chunks, min 10, max 100)
                </p>
              </div>
            </div>
            {/* Generate Button */}
            <button
              onClick={handleGenerateQuestions}
              disabled={isGenerating || !documentSlug}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                isGenerating || !documentSlug
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isGenerating ? (
                <>
                  <Spinner size="sm" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Generate</span>
                </>
              )}
            </button>
          </div>
        </div>
        <div className="px-6 py-4">

          {/* Generation Status - During Generation */}
          {isGenerating && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Spinner size="sm" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 mb-1">
                    {realtimeStatus.message || 'Generating quiz questions...'}
                  </p>
                  
                  {/* Detailed Progress */}
                  {realtimeStatus.progressDetails && (
                    <div className="mt-2 space-y-2">
                      {/* Batch Progress Bar */}
                      {realtimeStatus.progressDetails.totalBatches && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs text-blue-700 mb-1">
                            <span>Batch Progress</span>
                            <span>
                              {realtimeStatus.progressDetails.batchesCompleted || 0} / {realtimeStatus.progressDetails.totalBatches} batches completed
                            </span>
                          </div>
                          <div className="w-full bg-blue-200 rounded-full h-2.5">
                            <div 
                              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                              style={{ 
                                width: `${((realtimeStatus.progressDetails.batchesCompleted || 0) / realtimeStatus.progressDetails.totalBatches) * 100}%` 
                              }}
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* Batch-by-Batch Status */}
                      {realtimeStatus.progressDetails.totalBatches && realtimeStatus.progressDetails.batchStatus && (
                        <div className="mt-3">
                          <p className="text-xs font-medium text-blue-800 mb-2">Batch Status:</p>
                          <div className="grid grid-cols-5 gap-1">
                            {Array.from({ length: realtimeStatus.progressDetails.totalBatches }, (_, i) => {
                              const batchNum = i + 1;
                              const batchStatus = realtimeStatus.progressDetails.batchStatus?.[batchNum];
                              const isInProgress = realtimeStatus.progressDetails.batchesInProgress?.includes(batchNum);
                              
                              let bgColor = 'bg-gray-200';
                              let textColor = 'text-gray-600';
                              let label = batchNum.toString();
                              
                              if (batchStatus === 'completed') {
                                bgColor = 'bg-green-500';
                                textColor = 'text-white';
                                label = `${batchNum} ✓`;
                              } else if (batchStatus === 'generating' || isInProgress) {
                                bgColor = 'bg-blue-500';
                                textColor = 'text-white';
                                label = `${batchNum}...`;
                              } else if (batchStatus === 'failed') {
                                bgColor = 'bg-red-500';
                                textColor = 'text-white';
                                label = `${batchNum} ✗`;
                              }
                              
                              return (
                                <div
                                  key={batchNum}
                                  className={`${bgColor} ${textColor} rounded text-xs font-medium text-center py-1 px-1 transition-all duration-300`}
                                  title={`Batch ${batchNum}${batchStatus === 'completed' ? ' - Completed' : batchStatus === 'generating' || isInProgress ? ' - Generating' : batchStatus === 'failed' ? ' - Failed' : ' - Pending'}`}
                                >
                                  {label}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      {/* Current Batch Message */}
                      {realtimeStatus.progressDetails.batches && (
                        <p className="text-xs text-blue-800 font-medium mt-2">
                          {realtimeStatus.progressDetails.batches}
                        </p>
                      )}
                      
                      {/* Questions Generated/Stored */}
                      {realtimeStatus.progressDetails.questionsGenerated !== undefined && (
                        <p className="text-xs text-blue-700 mt-1">
                          ✓ Generated {realtimeStatus.progressDetails.questionsGenerated} questions
                        </p>
                      )}
                      {realtimeStatus.progressDetails.questionsStored !== undefined && (
                        <p className="text-xs text-blue-700 mt-1">
                          ✓ Stored {realtimeStatus.progressDetails.questionsStored} questions in database
                        </p>
                      )}
                    </div>
                  )}
                  
                  {!realtimeStatus.progressDetails && (
                    <p className="text-xs text-blue-700">
                      This may take a few moments. Questions are being generated from document chunks using AI.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Generation Success - Show Generated Data */}
          {generationSuccess && generationData && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900 mb-2">
                    ✓ Questions generated successfully!
                  </p>
                  <div className="space-y-1 text-xs text-green-800">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Number of questions:</span>
                      <span>{generationData.numQuestions}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Generated at:</span>
                      <span>{formatDate(new Date(generationData.generatedAt))}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Document:</span>
                      <span>{generationData.documentSlug}</span>
                    </div>
                  </div>
                  <p className="text-xs text-green-700 mt-2 italic">
                    Questions will appear below once the page refreshes.
                  </p>
                </div>
              </div>
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

