import React, { useState, useEffect, useRef } from 'react';
import { getQuiz, getQuizStatistics, generateAndStoreQuiz, type QuizQuestion, type QuizStatisticsResponse, type RegenerationLimitError, type GenerateAndStoreResponse } from '@/services/quizApi';
import { Spinner } from '@/components/UI/Spinner';
import { useQuizGenerationStatus } from '@/hooks/useQuizGenerationStatus';
import { debugLog } from '@/utils/debug';

interface QuizQuestionsAndStatsProps {
  documentSlug: string;
  isSuperAdmin?: boolean;
  onRegenerationSuccess?: () => void;
}

export function QuizQuestionsAndStats({ documentSlug, isSuperAdmin = false, onRegenerationSuccess }: QuizQuestionsAndStatsProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [statistics, setStatistics] = useState<QuizStatisticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerationError, setRegenerationError] = useState<string | null>(null);
  const [regenerationSuccess, setRegenerationSuccess] = useState(false);
  const [regenerationData, setRegenerationData] = useState<GenerateAndStoreResponse | null>(null);
  const [regenerationInfo, setRegenerationInfo] = useState<{
    lastGenerated: Date | null;
    nextAllowed: Date | null;
  } | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Subscribe to realtime quiz generation status (works across browser sessions)
  const realtimeStatus = useQuizGenerationStatus(documentSlug);

  // Track if we've already handled completion to prevent infinite loops
  const hasHandledCompletionRef = useRef(false);
  const lastStatusRef = useRef<string | null>(null);

  // Sync realtime status with local regeneration state
  useEffect(() => {
    const statusKey = `${realtimeStatus.isGenerating}-${realtimeStatus.completed}-${realtimeStatus.failed}`;
    
    // Skip if status hasn't changed
    if (statusKey === lastStatusRef.current) {
      return;
    }
    lastStatusRef.current = statusKey;

    if (realtimeStatus.isGenerating) {
      setIsRegenerating(true);
      setRegenerationError(null);
      setRegenerationSuccess(false);
      hasHandledCompletionRef.current = false; // Reset when generation starts
    } else if (realtimeStatus.completed && !hasHandledCompletionRef.current) {
      setIsRegenerating(false);
      hasHandledCompletionRef.current = true; // Mark as handled to prevent re-running
      // Refresh quiz data when generation completes
      const refreshData = async () => {
        try {
          const [quizData, statsData] = await Promise.all([
            getQuiz(documentSlug, true), // Fetch all questions for admin view
            getQuizStatistics(documentSlug).catch(() => null)
          ]);
          setQuestions(quizData.questions || []);
          setStatistics(statsData);
          setCurrentPage(1); // Reset to first page when data refreshes
          if (onRegenerationSuccess) {
            onRegenerationSuccess();
          }
        } catch (err) {
          debugLog('Error refreshing quiz data after completion:', err);
        }
      };
      refreshData();
    } else if (realtimeStatus.failed) {
      setIsRegenerating(false);
      setRegenerationError(realtimeStatus.message || 'Quiz regeneration failed');
      hasHandledCompletionRef.current = false; // Reset on failure
    }
  }, [realtimeStatus, documentSlug, onRegenerationSuccess]);

  useEffect(() => {
    if (!documentSlug) {
      setError('Document slug is required');
      setLoading(false);
      return;
    }

    const fetchQuizData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch questions and statistics in parallel
        // Use all=true to get all questions for admin view (not just random sample)
        const [quizData, statsData] = await Promise.all([
          getQuiz(documentSlug, true), // Fetch all questions for admin view
          getQuizStatistics(documentSlug).catch(err => {
            debugLog('Failed to fetch quiz statistics:', err);
            return null; // Statistics are optional, don't fail if they're not available
          })
        ]);

        setQuestions(quizData.questions || []);
        setStatistics(statsData);
        setCurrentPage(1); // Reset to first page when data loads
      } catch (err) {
        debugLog('Error fetching quiz data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load quiz data');
      } finally {
        setLoading(false);
      }
    };

    fetchQuizData();
  }, [documentSlug]);

  const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
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

  const handleRegenerate = async () => {
    if (!documentSlug) {
      setRegenerationError('Document slug is required');
      return;
    }

    setIsRegenerating(true);
    setRegenerationError(null);
    setRegenerationSuccess(false);
    setRegenerationData(null);

    try {
      debugLog('Regenerating quiz questions for document:', documentSlug);
      const result = await generateAndStoreQuiz(documentSlug);
      debugLog('Quiz regeneration successful:', result);
      
      setRegenerationData(result);
      setRegenerationSuccess(true);
      
      // Refresh the quiz data
      const [quizData, statsData] = await Promise.all([
        getQuiz(documentSlug, true), // Fetch all questions for admin view
        getQuizStatistics(documentSlug).catch(err => {
          debugLog('Failed to fetch quiz statistics:', err);
          return null;
        })
      ]);

      setQuestions(quizData.questions || []);
      setStatistics(statsData);
      setCurrentPage(1); // Reset to first page when data refreshes
      
      if (onRegenerationSuccess) {
        onRegenerationSuccess();
      }
    } catch (error) {
      debugLog('Quiz regeneration error:', error);
      
      // Check if it's a regeneration limit error
      if (error && typeof error === 'object' && 'nextAllowedDate' in error) {
        const limitError = error as RegenerationLimitError;
        setRegenerationInfo({
          lastGenerated: new Date(limitError.lastGenerated),
          nextAllowed: new Date(limitError.nextAllowedDate),
        });
        setRegenerationError(limitError.message);
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Failed to regenerate quiz questions';
        setRegenerationError(errorMessage);
      }
    } finally {
      setIsRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="md" />
        <span className="ml-3 text-gray-600">Loading quiz data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-800">{error}</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">No quiz questions found for this document.</p>
      </div>
    );
  }

  // Pagination calculations
  const totalPages = Math.ceil(questions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedQuestions = questions.slice(startIndex, endIndex);
  const startQuestionNumber = startIndex + 1;
  const endQuestionNumber = Math.min(endIndex, questions.length);

  // Handle page changes
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    setExpandedQuestion(null); // Close any expanded questions when changing pages
    // Scroll to top of questions section
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page
    setExpandedQuestion(null); // Close any expanded questions
  };

  return (
    <div className="space-y-8">
      {/* Regeneration Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-900">Quiz Questions</h4>
                <p className="text-xs text-gray-600 mt-0.5">
                  Regenerate questions based on document size (1 per 2 chunks, min 10, max 100)
                </p>
              </div>
            </div>
            {/* Regenerate Button */}
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating || !documentSlug}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                isRegenerating || !documentSlug
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isRegenerating ? (
                <>
                  <Spinner size="sm" />
                  <span>Regenerating...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Regenerate</span>
                </>
              )}
            </button>
          </div>
        </div>
        <div className="px-6 py-4">

          {/* Regeneration Status - During Generation */}
          {isRegenerating && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Spinner size="sm" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 mb-1">
                    {realtimeStatus.message || 'Regenerating quiz questions...'}
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
                      This may take a few moments. Questions are being regenerated from document chunks using AI.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Regeneration Success - Show Generated Data */}
          {regenerationSuccess && regenerationData && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900 mb-2">
                    ✓ Questions regenerated successfully!
                  </p>
                  <div className="space-y-1 text-xs text-green-800">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Number of questions:</span>
                      <span>{regenerationData.numQuestions}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Generated at:</span>
                      <span>{formatDate(new Date(regenerationData.generatedAt))}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Document:</span>
                      <span>{regenerationData.documentSlug}</span>
                    </div>
                  </div>
                  <p className="text-xs text-green-700 mt-2 italic">
                    Questions have been updated below.
                  </p>
                </div>
              </div>
            </div>
          )}

          {regenerationError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 font-medium mb-1">{regenerationError}</p>
              {regenerationInfo && regenerationInfo.nextAllowed && !isSuperAdmin && (
                <p className="text-xs text-red-700">
                  Last generated: {formatDate(regenerationInfo.lastGenerated!)}. 
                  Next allowed: {formatDate(regenerationInfo.nextAllowed)} ({getTimeUntilNextAllowed(regenerationInfo.nextAllowed)})
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Statistics Section */}
      {statistics && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quiz Statistics</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm text-blue-600 font-medium mb-1">Total Attempts</div>
              <div className="text-2xl font-bold text-blue-900">{statistics.totalAttempts}</div>
              {statistics.totalAttempts > 0 && (
                <div className="text-xs text-blue-700 mt-1">
                  {statistics.authenticatedAttempts} authenticated, {statistics.anonymousAttempts} anonymous
                </div>
              )}
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-sm text-green-600 font-medium mb-1">Average Score</div>
              <div className="text-2xl font-bold text-green-900">
                {statistics.averageScore.toFixed(1)}/{statistics.totalQuestions}
              </div>
              <div className="text-xs text-green-700 mt-1">
                {statistics.averagePercentage.toFixed(1)}% average
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="text-sm text-purple-600 font-medium mb-1">Highest Score</div>
              <div className="text-2xl font-bold text-purple-900">
                {statistics.highestScore}/{statistics.totalQuestions}
              </div>
              <div className="text-xs text-purple-700 mt-1">
                {statistics.totalAttempts > 0 ? `${((statistics.highestScore / statistics.totalQuestions) * 100).toFixed(1)}%` : 'N/A'}
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="text-sm text-orange-600 font-medium mb-1">Lowest Score</div>
              <div className="text-2xl font-bold text-orange-900">
                {statistics.lowestScore}/{statistics.totalQuestions}
              </div>
              <div className="text-xs text-orange-700 mt-1">
                {statistics.totalAttempts > 0 ? `${((statistics.lowestScore / statistics.totalQuestions) * 100).toFixed(1)}%` : 'N/A'}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              <span className="font-medium">Generated:</span> {formatDate(statistics.generatedAt)}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              <span className="font-medium">Total Questions:</span> {statistics.numQuestions}
            </div>
          </div>
        </div>
      )}

      {/* Question Generation Stats */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Question Generation Stats</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Total Questions Generated</span>
            <span className="text-sm font-semibold text-gray-900">{questions.length}</span>
          </div>
          {statistics && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Questions per Attempt</span>
              <span className="text-sm font-semibold text-gray-900">
                {statistics.configuredQuizSize || statistics.totalQuestions || 10}
                {statistics.totalAttempts === 0 && (
                  <span className="ml-2 text-xs text-gray-500 font-normal">(configured)</span>
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Questions List */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Quiz Questions ({questions.length} total)
          </h3>
          
          {/* Items per page selector */}
          {questions.length > 10 && (
            <div className="flex items-center gap-2">
              <label htmlFor="itemsPerPage" className="text-sm text-gray-600">
                Show:
              </label>
              <select
                id="itemsPerPage"
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={questions.length}>All</option>
              </select>
            </div>
          )}
        </div>
        
        {/* Pagination info */}
        {questions.length > itemsPerPage && (
          <div className="mb-4 text-sm text-gray-600">
            Showing {startQuestionNumber}-{endQuestionNumber} of {questions.length} questions
          </div>
        )}
        
        <div className="space-y-4">
          {paginatedQuestions.map((question, pageIndex) => {
            const actualIndex = startIndex + pageIndex;
            return (
              <div
                key={question.id || actualIndex}
                className={`border rounded-lg transition-all ${
                  expandedQuestion === actualIndex
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <button
                  onClick={() => setExpandedQuestion(expandedQuestion === actualIndex ? null : actualIndex)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-semibold text-gray-700">
                      {actualIndex + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-900 line-clamp-2">
                      {question.question}
                    </span>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ml-2 ${
                      expandedQuestion === actualIndex ? 'transform rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {expandedQuestion === actualIndex && (
                  <div className="px-4 pb-4 pt-2 border-t border-gray-200">
                    <div className="space-y-2 mt-2">
                      {question.options.map((option, optionIndex) => (
                        <div
                          key={optionIndex}
                          className={`p-3 rounded-lg border ${
                            optionIndex === question.correctAnswer
                              ? 'bg-green-50 border-green-200'
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                                optionIndex === question.correctAnswer
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-300 text-gray-700'
                              }`}
                            >
                              {String.fromCharCode(65 + optionIndex)}
                            </span>
                            <span className="text-sm text-gray-900 flex-1">{option}</span>
                            {optionIndex === question.correctAnswer && (
                              <span className="flex-shrink-0 text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded">
                                Correct
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  currentPage === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Previous
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  // Show first page, last page, current page, and pages around current
                  const showPage =
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1);
                  
                  if (!showPage) {
                    // Show ellipsis
                    const prevPage = page - 1;
                    const nextPage = page + 1;
                    if (
                      (prevPage === 1 || prevPage === currentPage - 2) &&
                      (nextPage === totalPages || nextPage === currentPage + 2)
                    ) {
                      return (
                        <span key={page} className="px-2 text-gray-400">
                          ...
                        </span>
                      );
                    }
                    return null;
                  }
                  
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        currentPage === page
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  currentPage === totalPages
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Next
              </button>
            </div>
            
            <div className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

