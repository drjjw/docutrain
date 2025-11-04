/**
 * useChatUrlParams - Hook for parsing and managing chat URL parameters
 * Handles document slug, embedding type, model selection, and other URL params
 * Ported from ChatPage.tsx
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useChatUrlParams() {
  const [searchParams] = useSearchParams();
  
  // Get document parameter (same as vanilla JS)
  // If no doc param, set to null to show document selector (matches vanilla JS behavior)
  const docParam = searchParams.get('doc');
  const [documentSlug, setDocumentSlug] = useState(docParam || null);
  
  // Get embedding type from URL parameter (same as vanilla JS)
  // Default: 'openai' for most docs, 'local' for ckd-dc-2025
  const getEmbeddingType = () => {
    const embeddingParam = searchParams.get('embedding');
    if (embeddingParam === 'local' || embeddingParam === 'openai') {
      return embeddingParam;
    }
    // Default to 'local' for ckd-dc-2025, 'openai' for others
    if (docParam?.includes('ckd-dc-2025')) {
      return 'local';
    }
    return 'openai';
  };
  const [embeddingType, setEmbeddingType] = useState(getEmbeddingType());

  // Get model from URL parameter (same as vanilla JS)
  // Default: 'grok' (same as vanilla JS main.js)
  const getModel = () => {
    const modelParam = searchParams.get('model');
    if (modelParam && (modelParam === 'gemini' || modelParam === 'grok' || modelParam === 'grok-reasoning')) {
      return modelParam;
    }
    return 'grok'; // Default to 'grok' (same as vanilla JS)
  };
  const [selectedModel, setSelectedModel] = useState(getModel());
  
  // Get owner parameter
  const ownerParam = searchParams.get('owner');
  
  // Check if footer should be shown (default: true, hide with footer=false)
  const footerParam = searchParams.get('footer');
  const shouldShowFooter = footerParam !== 'false';
  
  // Update document slug, embedding type, and model when URL param changes
  useEffect(() => {
    const doc = searchParams.get('doc');
    // If no doc param, set to null to show document selector (matches vanilla JS behavior)
    setDocumentSlug(doc || null);
    setEmbeddingType(getEmbeddingType());
    setSelectedModel(getModel());
  }, [searchParams]);
  
  // Log model choice when it changes
  useEffect(() => {
    const modelParam = searchParams.get('model');
    console.log(`🤖 Model choice: ${selectedModel}${modelParam ? '' : ' (default)'}`);
  }, [selectedModel, searchParams]);
  
  return {
    documentSlug,
    setDocumentSlug,
    embeddingType,
    selectedModel,
    shouldShowFooter,
    ownerParam,
  };
}




