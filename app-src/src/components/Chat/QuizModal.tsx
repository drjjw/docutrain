/**
 * QuizModal Component
 * Displays quiz questions in a modal with answer selection
 */

import React from 'react';
import { Modal } from '@/components/UI/Modal';
import { Spinner } from '@/components/UI/Spinner';
import { QuizQuestion } from '@/services/quizApi';

interface QuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  error: string | null;
  questions: QuizQuestion[];
  selectedAnswers: Record<number, number>;
  documentTitle: string | null;
  currentQuestionIndex: number;
  onSelectAnswer: (questionIndex: number, optionIndex: number) => void;
  onNextQuestion: () => void;
  onPreviousQuestion: () => void;
  onGoToQuestion: (index: number) => void;
  onRetry?: () => void;
}

export function QuizModal({
  isOpen,
  onClose,
  isLoading,
  error,
  questions,
  selectedAnswers,
  documentTitle,
  currentQuestionIndex,
  onSelectAnswer,
  onNextQuestion,
  onPreviousQuestion,
  onGoToQuestion,
  onRetry,
}: QuizModalProps) {
  const currentQuestion = questions[currentQuestionIndex];
  const selectedAnswer = selectedAnswers[currentQuestionIndex];
  const isAnswered = selectedAnswer !== undefined;
  const isCorrect = isAnswered && selectedAnswer === currentQuestion?.correctAnswer;
  const isFirstQuestion = currentQuestionIndex === 0;
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  const getAnswerClass = (optionIndex: number) => {
    if (!isAnswered || selectedAnswer !== optionIndex) {
      return 'border-gray-300 hover:border-gray-400 hover:bg-gray-50';
    }
    
    // Show correct/incorrect feedback
    const isCorrectOption = optionIndex === currentQuestion.correctAnswer;
    if (isCorrectOption) {
      return 'border-green-500 bg-green-50 text-green-900';
    } else {
      return 'border-red-500 bg-red-50 text-red-900';
    }
  };

  const getOptionLabel = (index: number) => {
    return String.fromCharCode(65 + index); // A, B, C, D
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={documentTitle ? `Quiz: ${documentTitle}` : 'Quiz'}
      size="lg"
    >
      <div className="space-y-6">
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Spinner />
            <p className="mt-4 text-gray-600">Generating quiz questions...</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">{error}</p>
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="mt-2 text-sm text-red-700 hover:text-red-900 underline"
                  >
                    Try again
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Questions */}
        {!isLoading && !error && questions.length > 0 && currentQuestion && (
          <div className="space-y-6">
            {/* Progress Indicator */}
            <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
              <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
              <div className="flex gap-1">
                {questions.map((_, index) => {
                  const canNavigate = index <= currentQuestionIndex || 
                                    selectedAnswers[index] !== undefined;
                  return (
                    <button
                      key={index}
                      onClick={() => {
                        if (canNavigate) {
                          onGoToQuestion(index);
                        }
                      }}
                      disabled={!canNavigate}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        index === currentQuestionIndex
                          ? 'bg-blue-600'
                          : selectedAnswers[index] !== undefined
                          ? 'bg-green-500'
                          : 'bg-gray-300'
                      } ${!canNavigate ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-75'}`}
                      title={`Question ${index + 1}${selectedAnswers[index] !== undefined ? ' (answered)' : ''}`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Current Question */}
            <div className="border-b border-gray-200 pb-6">
              {/* Question */}
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {currentQuestion.question}
              </h3>

              {/* Options */}
              <div className="space-y-2">
                {currentQuestion.options.map((option, optionIndex) => {
                  const isSelected = selectedAnswer === optionIndex;
                  const isCorrectOption = optionIndex === currentQuestion.correctAnswer;
                  
                  return (
                    <label
                      key={optionIndex}
                      className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        isAnswered
                          ? getAnswerClass(optionIndex)
                          : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                      } ${isAnswered && !isSelected ? 'opacity-60' : ''}`}
                    >
                      <input
                        type="radio"
                        name={`question-${currentQuestionIndex}`}
                        value={optionIndex}
                        checked={isSelected}
                        onChange={() => onSelectAnswer(currentQuestionIndex, optionIndex)}
                        disabled={isAnswered}
                        className="mt-1 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <span className="font-medium text-gray-700 mr-2">
                          {getOptionLabel(optionIndex)}.
                        </span>
                        <span className="text-gray-900">{option}</span>
                        {isAnswered && isCorrectOption && (
                          <span className="ml-2 text-green-600 font-medium">✓ Correct</span>
                        )}
                        {isAnswered && isSelected && !isCorrectOption && (
                          <span className="ml-2 text-red-600 font-medium">✗ Incorrect</span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Feedback */}
              {isAnswered && (
                <div className={`mt-3 p-3 rounded-lg ${
                  isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}>
                  <p className={`text-sm font-medium ${
                    isCorrect ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {isCorrect
                      ? '✓ Correct! Well done.'
                      : `✗ Incorrect. The correct answer is ${getOptionLabel(currentQuestion.correctAnswer)}: ${currentQuestion.options[currentQuestion.correctAnswer]}`
                    }
                  </p>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-200">
              <button
                onClick={onPreviousQuestion}
                disabled={isFirstQuestion}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  isFirstQuestion
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                ← Previous
              </button>
              
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={onNextQuestion}
                  disabled={isLastQuestion || !isAnswered}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    isLastQuestion || !isAnswered
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isLastQuestion ? 'Finish' : 'Next →'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && questions.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600">No questions available. Click "Generate Quiz" to create questions.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

