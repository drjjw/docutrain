/**
 * useOwnerLogo - Hook for fetching and caching owner logo configurations
 * Ported from vanilla JS config.js
 */

import { useState, useEffect } from 'react';

const OWNER_LOGO_CACHE_KEY = 'owner-logo-config-cache-v5';
const OWNER_LOGO_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

interface OwnerLogoConfig {
  logo: string;
  alt: string;
  link?: string;
  accentColor?: string;
}

interface OwnerConfigs {
  [slug: string]: OwnerLogoConfig;
}

export function useOwnerLogo(ownerSlug: string | null) {
  const [config, setConfig] = useState<OwnerLogoConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ownerSlug) {
      setConfig(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadConfig() {
      try {
        setLoading(true);
        setError(null);

        // Check cache first
        const cached = localStorage.getItem(OWNER_LOGO_CACHE_KEY);
        if (cached) {
          const { configs, timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;

          if (age < OWNER_LOGO_CACHE_TTL && configs[ownerSlug]) {
            if (!cancelled) {
              setConfig(configs[ownerSlug]);
              setLoading(false);
            }
            return;
          }
        }

        // Fetch from API
        const response = await fetch('/api/owners');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        // API returns { owners: { [slug]: config } }
        const configs: OwnerConfigs = data.owners || {};

        // Cache the results
        localStorage.setItem(OWNER_LOGO_CACHE_KEY, JSON.stringify({
          configs,
          timestamp: Date.now()
        }));

        if (!cancelled) {
          setConfig(configs[ownerSlug] || null);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load owner logo');
          setConfig(null);
          setLoading(false);
        }
      }
    }

    loadConfig();

    return () => {
      cancelled = true;
    };
  }, [ownerSlug]);

  return { config, loading, error };
}
