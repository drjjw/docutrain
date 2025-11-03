import { createClient } from '@supabase/supabase-js';

// Validate environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mlxctdgnojvkgfqldaob.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1seGN0ZGdub2p2a2dmcWxkYW9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NDE1MDgsImV4cCI6MjA3NjExNzUwOH0.f4434BqvCSAdr3HWdtLaGx5Yu0eW3auK7W2afHwb8nk';

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL environment variable');
}

if (!supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable');
}

// Detect if we're on mobile
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Create Supabase client with mobile-optimized realtime configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: isMobile ? 1 : 2, // Further reduce on mobile
    },
    // Mobile-optimized timeouts and connection settings
    timeout: isMobile ? 30000 : 20000, // 30s on mobile for slower connections
    heartbeatIntervalMs: isMobile ? 20000 : 15000, // Less frequent heartbeats on mobile
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-js-web',
    },
  },
});

// Handle page visibility changes on mobile to reconnect when app comes to foreground
if (isMobile && typeof document !== 'undefined') {
  let wasHidden = false;
  
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Page is hidden (backgrounded)
      wasHidden = true;
      console.log('[Supabase] Page hidden, WebSocket may disconnect');
    } else if (wasHidden) {
      // Page is visible again after being hidden
      console.log('[Supabase] Page visible again, reconnecting channels...');
      wasHidden = false;
      
      // Give the browser a moment to stabilize, then reconnect
      setTimeout(() => {
        // Get all channels and resubscribe
        const channels = supabase.getChannels();
        channels.forEach(channel => {
          console.log(`[Supabase] Resubscribing channel: ${channel.topic}`);
          // Unsubscribe and resubscribe to force reconnection
          supabase.removeChannel(channel).then(() => {
            // The hook will recreate the subscription
          });
        });
      }, 1000);
    }
  });
}

