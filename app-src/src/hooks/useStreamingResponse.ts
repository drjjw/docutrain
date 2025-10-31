import { useCallback } from 'react';
import { StreamingChunk } from '@/services/chatApi';
import { Message } from './useChat';

interface UseStreamingResponseOptions {
  onChunk: (chunk: string) => void;
  onComplete: (fullContent: string, metadata?: StreamingChunk['metadata']) => void;
  onError: (error: string) => void;
}

export function useStreamingResponse({ onChunk, onComplete, onError }: UseStreamingResponseOptions) {
  const processStream = useCallback(async (response: Response) => {
    const reader = response.body?.getReader();
    if (!reader) {
      onError('No response body - server may have closed connection');
      return;
    }

    const decoder = new TextDecoder();
    let fullResponse = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('📥 Stream finished, final response length:', fullResponse.length);
          // If stream ends without 'done' event, treat it as completion
          if (fullResponse) {
            onComplete(fullResponse);
          } else {
            onError('Stream ended with no content');
          }
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue; // Empty data line
            
            try {
              const data: StreamingChunk = JSON.parse(jsonStr);

              if (data.type === 'content' && data.chunk) {
                fullResponse += data.chunk;
                onChunk(fullResponse);
              } else if (data.type === 'done') {
                onComplete(fullResponse, data.metadata);
                return; // Exit early after done event
              } else if (data.type === 'error') {
                onError(data.error || 'Streaming error occurred');
                return;
              }
            } catch (parseError) {
              // Ignore parse errors for incomplete chunks, but log them for debugging
              if (jsonStr.length > 0) {
                console.warn('⚠️ Failed to parse SSE data:', jsonStr.substring(0, 100));
              }
            }
          }
        }
      }
    } catch (streamError: any) {
      console.error('❌ Stream reading error:', streamError);
      // If we have partial content, try to complete with what we have
      if (fullResponse) {
        console.log('⚠️ Stream error but had partial content, completing with:', fullResponse.length, 'chars');
        onComplete(fullResponse);
      } else {
        onError(streamError.message || 'Error reading stream');
      }
    }
  }, [onChunk, onComplete, onError]);

  return { processStream };
}

