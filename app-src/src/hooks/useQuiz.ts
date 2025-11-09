/**
 * useQuiz Hook
 * Manages quiz state and generation
 */

import { useState, useCallback } from 'react';
import { generateQuiz, QuizQuestion, QuizResponse } from '@/services/quizApi';

interface UseQuizOptions {
  documentSlug: string | null;
  numQuestions?: number;
}

interface UseQuizReturn {
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  questions: QuizQuestion[];
  selectedAnswers: Record<number, number>; // questionIndex -> optionIndex
  documentTitle: string | null;
  currentQuestionIndex: number;
  openQuiz: () => void;
  closeQuiz: () => void;
  generateQuiz: () => Promise<void>;
  selectAnswer: (questionIndex: number, optionIndex: number) => void;
  resetQuiz: () => void;
  goToNextQuestion: () => void;
  goToPreviousQuestion: () => void;
  goToQuestion: (index: number) => void;
}

export function useQuiz({ documentSlug, numQuestions = 5 }: UseQuizOptions): UseQuizReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [documentTitle, setDocumentTitle] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const generateQuizQuestions = useCallback(async () => {
    if (!documentSlug) {
      setError('No document selected');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSelectedAnswers({});
    setCurrentQuestionIndex(0);

    try {
      const response: QuizResponse = await generateQuiz(documentSlug, numQuestions);
      setQuestions(response.questions);
      setDocumentTitle(response.documentTitle);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate quiz';
      setError(errorMessage);
      setQuestions([]);
      setDocumentTitle(null);
    } finally {
      setIsLoading(false);
    }
  }, [documentSlug, numQuestions]);

  const openQuiz = useCallback(() => {
    setIsOpen(true);
    setError(null);
    setCurrentQuestionIndex(0);
    // If no questions loaded yet, generate them
    if (questions.length === 0 && documentSlug) {
      generateQuizQuestions();
    }
  }, [documentSlug, questions.length, generateQuizQuestions]);

  const closeQuiz = useCallback(() => {
    setIsOpen(false);
  }, []);

  const selectAnswer = useCallback((questionIndex: number, optionIndex: number) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionIndex]: optionIndex,
    }));
  }, []);

  const resetQuiz = useCallback(() => {
    setQuestions([]);
    setSelectedAnswers({});
    setError(null);
    setDocumentTitle(null);
    setCurrentQuestionIndex(0);
  }, []);

  const goToNextQuestion = useCallback(() => {
    setCurrentQuestionIndex(prev => Math.min(prev + 1, questions.length - 1));
  }, [questions.length]);

  const goToPreviousQuestion = useCallback(() => {
    setCurrentQuestionIndex(prev => Math.max(prev - 1, 0));
  }, []);

  const goToQuestion = useCallback((index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentQuestionIndex(index);
    }
  }, [questions.length]);

  return {
    isOpen,
    isLoading,
    error,
    questions,
    selectedAnswers,
    documentTitle,
    currentQuestionIndex,
    openQuiz,
    closeQuiz,
    generateQuiz: generateQuizQuestions,
    selectAnswer,
    resetQuiz,
    goToNextQuestion,
    goToPreviousQuestion,
    goToQuestion,
  };
}
