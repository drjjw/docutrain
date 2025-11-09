/**
 * MissionControl Component
 * 
 * Displays system configuration values for superadmins to verify
 * what settings are actually loaded and running.
 */

import { useState, useEffect } from 'react';
import { Spinner } from '@/components/UI/Spinner';
import { Alert } from '@/components/UI/Alert';
import { getAuthHeaders } from '@/lib/api/authService';

interface ConfigValue {
  [key: string]: string | number | boolean;
}

interface ConfigResponse {
  success: boolean;
  config: ConfigValue;
  note?: string;
  error?: string;
}

export function MissionControl() {
  const [config, setConfig] = useState<ConfigValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/users/config', {
          headers: getAuthHeaders()
        });

        if (!response.ok) {
          if (response.status === 403) {
            throw new Error('Super admin access required');
          }
          throw new Error(`Failed to fetch configuration: ${response.statusText}`);
        }

        const data: ConfigResponse = await response.json();
        
        if (data.success && data.config) {
          setConfig(data.config);
        } else {
          throw new Error(data.error || 'Failed to load configuration');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="error">
        {error}
      </Alert>
    );
  }

  if (!config) {
    return (
      <Alert variant="warning">
        No configuration data available
      </Alert>
    );
  }

  // Group configuration by category
  const categories = {
    'Conversation Limits': {
      MAX_CONVERSATION_LENGTH: config.MAX_CONVERSATION_LENGTH,
      VITE_MAX_CONVERSATION_LENGTH: config.VITE_MAX_CONVERSATION_LENGTH,
    },
    'Rate Limiting': {
      RATE_LIMIT_PER_MINUTE: config.RATE_LIMIT_PER_MINUTE,
      RATE_LIMIT_PER_TEN_SECONDS: config.RATE_LIMIT_PER_TEN_SECONDS,
    },
    'RAG Configuration': {
      RAG_SIMILARITY_THRESHOLD: config.RAG_SIMILARITY_THRESHOLD,
      USE_EDGE_FUNCTIONS: config.USE_EDGE_FUNCTIONS,
    },
    'Server Configuration': {
      PORT: config.PORT,
      NODE_ENV: config.NODE_ENV,
      DEBUG: config.DEBUG,
    },
    'API Keys Status': {
      GEMINI_API_KEY: config.GEMINI_API_KEY,
      XAI_API_KEY: config.XAI_API_KEY,
      OPENAI_API_KEY: config.OPENAI_API_KEY,
    },
    'Supabase Configuration': {
      SUPABASE_URL: config.SUPABASE_URL,
      SUPABASE_ANON_KEY: config.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: config.SUPABASE_SERVICE_ROLE_KEY,
    },
    'Email Configuration': {
      RESEND_API_KEY: config.RESEND_API_KEY,
      CONTACT_EMAIL: config.CONTACT_EMAIL,
      RESEND_FROM_EMAIL: config.RESEND_FROM_EMAIL,
    },
    'System Info': {
      timestamp: config.timestamp,
      serverTime: config.serverTime,
    },
  };

  const getValueDisplay = (value: any): string => {
    if (typeof value === 'boolean') {
      return value ? '✓ Enabled' : '✗ Disabled';
    }
    if (typeof value === 'number') {
      return value.toString();
    }
    return String(value);
  };

  const getValueColor = (value: any): string => {
    if (typeof value === 'string') {
      if (value.includes('✓')) return 'text-green-600';
      if (value.includes('✗')) return 'text-red-600';
    }
    if (typeof value === 'boolean') {
      return value ? 'text-green-600' : 'text-gray-600';
    }
    return 'text-gray-900';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">🚀 Mission Control</h2>
        <p className="text-gray-600">
          System configuration verification. All values are loaded from environment variables at runtime.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(categories).map(([categoryName, categoryConfig]) => (
          <div
            key={categoryName}
            className="bg-white rounded-lg border border-gray-200 shadow-sm p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              {categoryName}
            </h3>
            <dl className="space-y-3">
              {Object.entries(categoryConfig).map(([key, value]) => (
                <div key={key} className="flex justify-between items-start">
                  <dt className="text-sm font-medium text-gray-600 pr-4">
                    {key}
                  </dt>
                  <dd className={`text-sm font-mono ${getValueColor(value)} text-right break-all`}>
                    {getValueDisplay(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">💡 Notes</h4>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Configuration values are read from environment variables at server startup</li>
          <li>Sensitive values (API keys, tokens) are masked for security</li>
          <li>Frontend values (VITE_*) are baked into the build at build time</li>
          <li>To change backend values, update the production server's <code className="bg-blue-100 px-1 rounded">.env</code> file and restart</li>
          <li>To change frontend values, update <code className="bg-blue-100 px-1 rounded">.env</code> and rebuild</li>
        </ul>
      </div>
    </div>
  );
}

