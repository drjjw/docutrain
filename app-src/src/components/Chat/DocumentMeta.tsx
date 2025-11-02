/**
 * DocumentMeta - Component to update page meta tags dynamically based on document
 * Updates title, description, Open Graph, and Twitter Card meta tags
 */

import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import { useDocumentConfig } from '@/hooks/useDocumentConfig';

interface DocumentMetaProps {
  documentSlug: string | null;
}

export function DocumentMeta({ documentSlug }: DocumentMetaProps) {
  const [searchParams] = useSearchParams();
  const { config: docConfig } = useDocumentConfig(documentSlug);

  // If no document is selected, use default meta tags
  if (!documentSlug || !docConfig) {
    return (
      <Helmet>
        <title>AI Document Assistant - Dashboard</title>
        <meta name="description" content="Manage your AI-powered document analysis" />
        <meta property="og:title" content="AI Document Assistant - Dashboard" />
        <meta property="og:description" content="Manage your AI-powered document analysis" />
        <meta name="twitter:title" content="AI Document Assistant - Dashboard" />
        <meta name="twitter:description" content="Manage your AI-powered document analysis" />
      </Helmet>
    );
  }

  // Build title and description
  const title = docConfig.title;
  const description = docConfig.subtitle || docConfig.welcomeMessage || 'AI-powered document assistant';
  
  // Get current URL for og:url
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  
  // Get cover image if available
  const ogImage = docConfig.cover || '';

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      {currentUrl && <meta property="og:url" content={currentUrl} />}
      {ogImage && <meta property="og:image" content={ogImage} />}
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
    </Helmet>
  );
}

