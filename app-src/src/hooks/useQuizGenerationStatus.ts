/**
 * useQuizGenerationStatus - Hook for realtime quiz generation status updates
 * Subscribes to document_processing_logs table for quiz generation progress
 * Works across browser sessions/tabs
 * Restores progress state when page is reloaded
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getQuizStatus } from '@/services/quizApi';
import { debugLog } from '@/utils/debug';

export interface QuizGenerationStatus {
  isGenerating: boolean;
  stage?: string;
  message?: string;
  completed?: boolean;
  failed?: boolean;
  progressDetails?: {
    batches?: string; // e.g., "Batch 1/5: Generating 20 questions"
    questionsGenerated?: number;
    totalBatches?: number;
    currentBatch?: number;
    questionsStored?: number;
    batchesCompleted?: number; // Number of batches completed
    batchesInProgress?: number[]; // Array of batch numbers currently processing
    batchStatus?: Record<number, 'generating' | 'completed' | 'failed'>; // Status of each batch
  };
}

// Helper function to parse log entry and extract progress details
function parseLogProgress(log: any, previousDetails?: QuizGenerationStatus['progressDetails']): QuizGenerationStatus['progressDetails'] {
  const metadata = log.metadata || {};
  const progressDetails: QuizGenerationStatus['progressDetails'] = {
    ...previousDetails, // Preserve previous batch status
    batchStatus: previousDetails?.batchStatus || {}
  };
  
  // Extract batch information from message
  const message = log.message || '';
  
  // Match "Batch X/Y: Generating N questions" or "Batch X/Y completed: N questions"
  const batchMatch = message.match(/Batch (\d+)\/(\d+)/);
  if (batchMatch) {
    const batchNum = parseInt(batchMatch[1]);
    const totalBatches = parseInt(batchMatch[2]);
    progressDetails.currentBatch = batchNum;
    progressDetails.totalBatches = totalBatches;
    progressDetails.batches = message;
    
    // Check if batch is completed
    if (message.includes('completed')) {
      progressDetails.batchStatus![batchNum] = 'completed';
      // Count completed batches
      const completedCount = Object.values(progressDetails.batchStatus!).filter(s => s === 'completed').length;
      progressDetails.batchesCompleted = completedCount;
    } else if (message.includes('Generating') || message.includes('failed')) {
      progressDetails.batchStatus![batchNum] = message.includes('failed') ? 'failed' : 'generating';
    }
  }
  
  // Match "Processing batches X-Y/Z (N concurrent)"
  const processingMatch = message.match(/Processing batches (\d+)-(\d+)\/(\d+)/);
  if (processingMatch) {
    const startBatch = parseInt(processingMatch[1]);
    const endBatch = parseInt(processingMatch[2]);
    const totalBatches = parseInt(processingMatch[3]);
    progressDetails.totalBatches = totalBatches;
    progressDetails.batchesInProgress = [];
    for (let i = startBatch; i <= endBatch; i++) {
      progressDetails.batchesInProgress.push(i);
      if (!progressDetails.batchStatus![i]) {
        progressDetails.batchStatus![i] = 'generating';
      }
    }
  }
  
  // Extract questions generated from metadata or message
  if (metadata.questionsGenerated !== undefined) {
    progressDetails.questionsGenerated = metadata.questionsGenerated;
  } else if (metadata.questionsStored !== undefined) {
    progressDetails.questionsStored = metadata.questionsStored;
  } else {
    // Try to extract from "Batch X/Y completed: N questions"
    const completedMatch = message.match(/Batch \d+\/\d+ completed: (\d+) questions/);
    if (completedMatch) {
      progressDetails.questionsGenerated = (progressDetails.questionsGenerated || 0) + parseInt(completedMatch[1]);
    } else {
      const questionsMatch = message.match(/(\d+)\s+questions/);
      if (questionsMatch) {
        progressDetails.questionsGenerated = parseInt(questionsMatch[1]);
      }
    }
  }
  
  return Object.keys(progressDetails).length > 0 ? progressDetails : undefined;
}

export function useQuizGenerationStatus(documentSlug: string | null): QuizGenerationStatus {
  const [status, setStatus] = useState<QuizGenerationStatus>({ isGenerating: false });

  useEffect(() => {
    if (!documentSlug) {
      setStatus({ isGenerating: false });
      return;
    }

    let cancelled = false;

    // First, check current quiz status and restore progress if generating
    async function restoreProgress() {
      try {
        // Check quiz status from database
        const quizStatus = await getQuizStatus(documentSlug);
        
        if (cancelled) return;
        
        // If quiz is generating, fetch latest log entry to restore progress
        if (quizStatus.status === 'generating') {
          debugLog(`[useQuizGenerationStatus] Quiz is generating, fetching latest log entry...`);
          
          const { data: logs, error } = await supabase
            .from('document_processing_logs')
            .select('*')
            .eq('document_slug', documentSlug)
            .eq('stage', 'quiz')
            .order('created_at', { ascending: false })
            .limit(50); // Get more logs to build up batch status
          
          if (!cancelled && !error && logs && logs.length > 0) {
            // Process all recent logs to build up batch status
            let accumulatedDetails: QuizGenerationStatus['progressDetails'] | undefined;
            for (const log of logs.slice().reverse()) { // Process in chronological order
              accumulatedDetails = parseLogProgress(log, accumulatedDetails);
            }
            
            debugLog(`[useQuizGenerationStatus] Restored progress from logs:`, accumulatedDetails);
            
            // Restore status based on latest log
            const latestLog = logs[0];
            if (latestLog.status === 'started' || latestLog.status === 'progress') {
              setStatus({
                isGenerating: true,
                stage: latestLog.stage,
                message: latestLog.message,
                completed: false,
                failed: false,
                progressDetails: accumulatedDetails,
              });
            } else if (latestLog.status === 'completed') {
              setStatus({
                isGenerating: false,
                stage: latestLog.stage,
                message: latestLog.message,
                completed: true,
                failed: false,
                progressDetails: accumulatedDetails,
              });
            } else if (latestLog.status === 'failed') {
              setStatus({
                isGenerating: false,
                stage: latestLog.stage,
                message: latestLog.message,
                completed: false,
                failed: true,
                progressDetails: accumulatedDetails,
              });
            }
          } else if (!cancelled && quizStatus.status === 'generating') {
            // Quiz is generating but no logs yet - set initial state
            setStatus({
              isGenerating: true,
              stage: 'quiz',
              message: 'Starting quiz generation...',
              completed: false,
              failed: false,
            });
          }
        } else if (quizStatus.status === 'completed') {
          // Quiz is completed
          setStatus({
            isGenerating: false,
            stage: 'quiz',
            message: 'Quiz generation completed',
            completed: true,
            failed: false,
          });
        } else if (quizStatus.status === 'failed') {
          // Quiz generation failed
          setStatus({
            isGenerating: false,
            stage: 'quiz',
            message: 'Quiz generation failed',
            completed: false,
            failed: true,
          });
        }
      } catch (error) {
        debugLog(`[useQuizGenerationStatus] Error restoring progress:`, error);
        // Continue with realtime subscription even if restore fails
      }
    }

    restoreProgress();

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

          // Update status based on log, preserving previous batch status
          setStatus(prevStatus => {
            const progressDetails = parseLogProgress(log, prevStatus.progressDetails);
            
            if (log.status === 'started') {
              return {
                isGenerating: true,
                stage: log.stage,
                message: log.message,
                completed: false,
                failed: false,
                progressDetails,
              };
            } else if (log.status === 'progress') {
              return {
                isGenerating: true,
                stage: log.stage,
                message: log.message,
                completed: false,
                failed: false,
                progressDetails,
              };
            } else if (log.status === 'completed') {
              return {
                isGenerating: false,
                stage: log.stage,
                message: log.message,
                completed: true,
                failed: false,
                progressDetails,
              };
            } else if (log.status === 'failed') {
              return {
                isGenerating: false,
                stage: log.stage,
                message: log.message,
                completed: false,
                failed: true,
                progressDetails,
              };
            }
            
            // Default: just update progress details
            return {
              ...prevStatus,
              progressDetails,
            };
          });
        }
      )
      .subscribe((status, err) => {
        debugLog(`[useQuizGenerationStatus] Subscription status:`, status);
        if (err) {
          debugLog(`[useQuizGenerationStatus] Subscription error:`, err);
        }
      });

    return () => {
      cancelled = true;
      debugLog(`[useQuizGenerationStatus] Cleaning up subscription for ${documentSlug}`);
      supabase.removeChannel(channel);
    };
  }, [documentSlug]);

  return status;
}

