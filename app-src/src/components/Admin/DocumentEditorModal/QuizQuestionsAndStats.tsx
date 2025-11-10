import React, { useState, useEffect } from 'react';
import { getQuiz, getQuizStatistics, type QuizQuestion, type QuizStatisticsResponse } from '@/services/quizApi';
import { Spinner } from '@/components/UI/Spinner';
import { debugLog } from '@/utils/debug';

interface QuizQuestionsAndStatsProps {
  documentSlug: string;
}

export function QuizQuestionsAndStats({ documentSlug }: QuizQuestionsAndStatsProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [statistics, setStatistics] = useState<QuizStatisticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

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

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(dateString));
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

