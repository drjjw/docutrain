import React, { useState, useEffect } from 'react';
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

  // Subscribe to realtime quiz generation status (works across browser sessions)
  const realtimeStatus = useQuizGenerationStatus(documentSlug);

  // Sync realtime status with local regeneration state
  useEffect(() => {
    if (realtimeStatus.isGenerating) {
      setIsRegenerating(true);
      setRegenerationError(null);
      setRegenerationSuccess(false);
    } else if (realtimeStatus.completed) {
      setIsRegenerating(false);
      // Refresh quiz data when generation completes
      const refreshData = async () => {
        try {
          const [quizData, statsData] = await Promise.all([
            getQuiz(documentSlug),
            getQuizStatistics(documentSlug).catch(() => null)
          ]);
          setQuestions(quizData.questions || []);
          setStatistics(statsData);
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
        const [quizData, statsData] = await Promise.all([
          getQuiz(documentSlug),
          getQuizStatistics(documentSlug).catch(err => {
            debugLog('Failed to fetch quiz statistics:', err);
            return null; // Statistics are optional, don't fail if they're not available
          })
        ]);

        setQuestions(quizData.questions || []);
        setStatistics(statsData);
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
        getQuiz(documentSlug),
        getQuizStatistics(documentSlug).catch(err => {
          debugLog('Failed to fetch quiz statistics:', err);
          return null;
        })
      ]);

      setQuestions(quizData.questions || []);
      setStatistics(statsData);
      
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
                  <p className="text-xs text-blue-700">
                    This may take a few moments. Questions are being regenerated from document chunks using AI.
                  </p>
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
              <span className="text-sm font-semibold text-gray-900">{statistics.totalQuestions}</span>
            </div>
          )}
        </div>
      </div>

      {/* Questions List */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quiz Questions ({questions.length})</h3>
        
        <div className="space-y-4">
          {questions.map((question, index) => (
            <div
              key={index}
              className={`border rounded-lg transition-all ${
                expandedQuestion === index
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <button
                onClick={() => setExpandedQuestion(expandedQuestion === index ? null : index)}
                className="w-full px-4 py-3 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-semibold text-gray-700">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium text-gray-900 line-clamp-2">
                    {question.question}
                  </span>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ml-2 ${
                    expandedQuestion === index ? 'transform rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expandedQuestion === index && (
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
          ))}
        </div>
      </div>
    </div>
  );
}

