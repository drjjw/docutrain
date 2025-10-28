module.exports = {
  apps: [{
    name: 'docutrainio-bot',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    cwd: '/home/docutrainio/public_html',
    env_file: '.env',
    env: {
      NODE_ENV: 'production'
    },
    // Graceful shutdown configuration
    kill_timeout: 5000, // Wait 5 seconds for graceful shutdown
    wait_ready: false,    // Don't wait for ready signal - let server start normally
    listen_timeout: 15000, // Wait 15 seconds for app to listen (RAG-only is faster)

    // Restart policies
    restart_delay: 6000, // Delay between restarts (increased)
    max_restarts: 3,     // Max restarts within restart_window (reduced)
    min_uptime: '10s',   // Minimum uptime before considering restart successful (increased)

    // Graceful reload settings
    graceful_reload: {
      enabled: true,
      timeout: 5000  // Timeout for graceful reload
    },

    // Readiness check (PM2 will ping this endpoint to determine if app is ready)
    health_check: {
      enabled: true,
      url: '/api/ready',
      interval: 60000, // Check every 60 seconds (less aggressive)
      timeout: 10000,  // Timeout for readiness check (increased)
      unhealthy_threshold: 2, // Mark unhealthy after 2 failures (more tolerant)
      healthy_threshold: 1    // Mark healthy after 1 success
    },

    // Logging
    log_file: 'server.log',
    out_file: 'server.log',
    error_file: 'server-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

    // Environment-specific settings
    env_production: {
      NODE_ENV: 'production',
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY
    }
  }]
};
