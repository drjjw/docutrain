/**
 * useQuizGenerationStatus - Hook for realtime quiz generation status updates
 * Subscribes to document_processing_logs table for quiz generation progress
 * Works across browser sessions/tabs
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { debugLog } from '@/utils/debug';

export interface QuizGenerationStatus {
  isGenerating: boolean;
  stage?: string;
  message?: string;
  completed?: boolean;
  failed?: boolean;
}

export function useQuizGenerationStatus(documentSlug: string | null): QuizGenerationStatus {
  const [status, setStatus] = useState<QuizGenerationStatus>({ isGenerating: false });

  useEffect(() => {
    if (!documentSlug) {
      setStatus({ isGenerating: false });
      return;
    }

    debugLog(`[useQuizGenerationStatus] Setting up realtime subscription for quiz generation: ${documentSlug}`);

    const channel = supabase
      .channel(`quiz_generation_${documentSlug}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'document_processing_logs',
          // Note: Supabase realtime doesn't support multiple conditions in filter
          // Filter by document_slug only, then check stage in callback
          filter: `document_slug=eq.${documentSlug}`,
        },
        (payload) => {
          debugLog(`[useQuizGenerationStatus] 📡 Processing log received:`, payload);
          
          const log = payload.new as any;
          if (!log) return;

          // Only process quiz stage logs
          if (log.stage !== 'quiz') {
            debugLog(`[useQuizGenerationStatus] Ignoring non-quiz log: stage=${log.stage}`);
            return;
          }

          debugLog(`[useQuizGenerationStatus] 📡 Quiz generation log received:`, payload);

          // Update status based on log
          if (log.status === 'started') {
            setStatus({
              isGenerating: true,
              stage: log.stage,
              message: log.message,
              completed: false,
              failed: false,
            });
          } else if (log.status === 'progress') {
            setStatus({
              isGenerating: true,
              stage: log.stage,
              message: log.message,
              completed: false,
              failed: false,
            });
          } else if (log.status === 'completed') {
            setStatus({
              isGenerating: false,
              stage: log.stage,
              message: log.message,
              completed: true,
              failed: false,
            });
          } else if (log.status === 'failed') {
            setStatus({
              isGenerating: false,
              stage: log.stage,
              message: log.message,
              completed: false,
              failed: true,
            });
          }
        }
      )
      .subscribe((status, err) => {
        debugLog(`[useQuizGenerationStatus] Subscription status:`, status);
        if (err) {
          debugLog(`[useQuizGenerationStatus] Subscription error:`, err);
        }
      });

    return () => {
      debugLog(`[useQuizGenerationStatus] Cleaning up subscription for ${documentSlug}`);
      supabase.removeChannel(channel);
    };
  }, [documentSlug]);

  return status;
}

