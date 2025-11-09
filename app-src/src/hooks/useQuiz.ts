/**
 * useQuiz Hook
 * Manages quiz state and loads pre-generated quizzes from database
 */

import { useState, useCallback } from 'react';
import { getQuiz, QuizQuestion, QuizResponse } from '@/services/quizApi';

interface UseQuizOptions {
  documentSlug: string | null;
}

interface UseQuizReturn {
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  questions: QuizQuestion[];
  selectedAnswers: Record<number, number>; // questionIndex -> optionIndex
  documentTitle: string | null;
  currentQuestionIndex: number;
  quizId: string | null;
  openQuiz: () => void;
  closeQuiz: () => void;
  loadQuiz: () => Promise<void>;
  selectAnswer: (questionIndex: number, optionIndex: number) => void;
  resetQuiz: () => void;
  goToNextQuestion: () => void;
  goToPreviousQuestion: () => void;
  goToQuestion: (index: number) => void;
}

export function useQuiz({ documentSlug }: UseQuizOptions): UseQuizReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [documentTitle, setDocumentTitle] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [quizId, setQuizId] = useState<string | null>(null);

  const loadQuizQuestions = useCallback(async () => {
    if (!documentSlug) {
      setError('No document selected');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSelectedAnswers({});
    setCurrentQuestionIndex(0);

    try {
      const response: QuizResponse = await getQuiz(documentSlug);
      setQuestions(response.questions);
      setDocumentTitle(response.documentTitle);
      if (response.quizId) {
        setQuizId(response.quizId);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load quiz';
      setError(errorMessage);
      setQuestions([]);
      setDocumentTitle(null);
      setQuizId(null);
    } finally {
      setIsLoading(false);
    }
  }, [documentSlug]);

  const openQuiz = useCallback(() => {
    setIsOpen(true);
    setError(null);
    setCurrentQuestionIndex(0);
    // Load quiz questions if not already loaded
    if (questions.length === 0 && documentSlug) {
      loadQuizQuestions();
    }
  }, [documentSlug, questions.length, loadQuizQuestions]);

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
    setQuizId(null);
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
    quizId,
    openQuiz,
    closeQuiz,
    loadQuiz: loadQuizQuestions,
    selectAnswer,
    resetQuiz,
    goToNextQuestion,
    goToPreviousQuestion,
    goToQuestion,
  };
}
