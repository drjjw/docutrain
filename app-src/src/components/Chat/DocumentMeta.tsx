/**
 * DocumentMeta - Component to update page meta tags dynamically based on document
 * Updates title, description, Open Graph, and Twitter Card meta tags
 * Uses React 19's native metadata support (no react-helmet-async needed)
 */

import { useEffect } from 'react';
import { useDocumentConfig } from '@/hooks/useDocumentConfig';

interface DocumentMetaProps {
  documentSlug: string | null;
}

// Helper function to convert relative URLs to absolute URLs
function ensureAbsoluteUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  
  // If already absolute (starts with http:// or https://), return as-is
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  
  // If relative, make absolute using current origin
  if (typeof window !== 'undefined') {
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    return `${window.location.origin}${cleanPath}`;
  }
  
  return url;
}

export function DocumentMeta({ documentSlug }: DocumentMetaProps) {
  const { config: docConfig } = useDocumentConfig(documentSlug);

  useEffect(() => {
    let title: string;
    let description: string;
    let ogImage: string | undefined;
    let currentUrl: string | undefined;

    // If no document is selected, use default meta tags
    if (!documentSlug || !docConfig) {
      title = 'AI Document Assistant - Intelligent Knowledge Base';
      description = 'AI-powered document assistant with RAG technology for medical guidelines, research papers, and knowledge bases';
      ogImage = '/chat-cover-place.jpeg';
    } else {
      title = docConfig.title;
      description = docConfig.subtitle || docConfig.welcomeMessage || 'AI-powered document assistant';
      ogImage = docConfig.cover || '/chat-cover-place.jpeg';
    }

    // Ensure image URL is absolute for OG tags
    const absoluteOgImage = ensureAbsoluteUrl(ogImage);
    
    // Get current URL
    if (typeof window !== 'undefined') {
      currentUrl = window.location.href;
    }

    // Update title
    document.title = title;

    // Helper function to update or create meta tags
    const updateMetaTag = (attr: 'name' | 'property', attrValue: string, content: string) => {
      const selector = `meta[${attr}="${attrValue}"]`;
      let element = document.querySelector(selector) as HTMLMetaElement;
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attr, attrValue);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // Helper function to update or create link tags
    const updateLinkTag = (rel: string, href: string) => {
      const selector = `link[rel="${rel}"]`;
      let element = document.querySelector(selector) as HTMLLinkElement;
      if (!element) {
        element = document.createElement('link');
        element.setAttribute('rel', rel);
        document.head.appendChild(element);
      }
      element.setAttribute('href', href);
    };

    // Update description
    updateMetaTag('name', 'description', description);

    // Update Open Graph tags
    updateMetaTag('property', 'og:type', 'website');
    updateMetaTag('property', 'og:title', title);
    updateMetaTag('property', 'og:description', description);
    if (currentUrl) {
      updateMetaTag('property', 'og:url', currentUrl);
    }
    updateMetaTag('property', 'og:site_name', 'DocuTrain');
    updateMetaTag('property', 'og:locale', 'en_US');
    
    // Update og:image with all related tags
    if (absoluteOgImage) {
      updateMetaTag('property', 'og:image', absoluteOgImage);
      updateMetaTag('property', 'og:image:secure_url', absoluteOgImage);
      updateMetaTag('property', 'og:image:type', 'image/jpeg');
      updateMetaTag('property', 'og:image:width', '1200');
      updateMetaTag('property', 'og:image:height', '630');
      updateMetaTag('property', 'og:image:alt', title);
    }

    // Update Twitter Card tags
    updateMetaTag('name', 'twitter:card', 'summary_large_image');
    updateMetaTag('name', 'twitter:title', title);
    updateMetaTag('name', 'twitter:description', description);
    updateMetaTag('name', 'twitter:site', '@DocuTrain');
    if (absoluteOgImage) {
      updateMetaTag('name', 'twitter:image', absoluteOgImage);
      updateMetaTag('name', 'twitter:image:alt', title);
    }

    // Update canonical URL
    if (currentUrl) {
      updateLinkTag('canonical', currentUrl);
    }

    // Update structured data (JSON-LD) for client-side navigation
    const updateStructuredData = (data: object) => {
      const jsonLd = JSON.stringify(data, null, 2);
      const scriptTag = document.createElement('script');
      scriptTag.type = 'application/ld+json';
      scriptTag.textContent = jsonLd;
      
      // Remove existing structured data
      const existing = document.querySelector('script[type="application/ld+json"]');
      if (existing) {
        existing.remove();
      }
      
      // Add new structured data
      document.head.appendChild(scriptTag);
    };

    if (docConfig && currentUrl) {
      const structuredData = {
        "@context": "https://schema.org",
        "@type": "DigitalDocument",
        "name": docConfig.title,
        "description": docConfig.subtitle || docConfig.welcomeMessage || "AI-powered document assistant",
        "url": currentUrl,
        "encodingFormat": "application/pdf",
        "inLanguage": "en-US",
        "isPartOf": {
          "@type": "WebApplication",
          "name": "DocuTrain",
          "url": typeof window !== 'undefined' ? window.location.origin : ''
        }
      };
      updateStructuredData(structuredData);
    }
  }, [documentSlug, docConfig]);

  // React 19 native metadata support - return null as component doesn't render anything
  return null;
}

