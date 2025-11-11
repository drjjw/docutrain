/**
 * In-memory rate limiter
 * Tracks message timestamps per session to prevent spam/automation
 */

class RateLimiter {
    constructor() {
        // Map of sessionId -> array of timestamps
        this.sessions = new Map();
        
        // Rate limit configuration
        this.limits = {
            perMinute: 10,      // Max 10 messages per minute
            perTenSeconds: 3    // Max 3 messages per 10 seconds (burst protection)
        };
        
        // Cleanup old entries every 5 minutes to prevent memory leaks
        setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
    
    /**
     * Check if a session has exceeded rate limits
     * @param {string} sessionId - Session UUID
     * @returns {Object} { allowed: boolean, retryAfter: number }
     */
    checkLimit(sessionId) {
        const now = Date.now();
        // Enable debug logging if explicitly enabled via env var, or in development mode
        const debugEnabled = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';
        
        // Get or create timestamp array for this session
        if (!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, []);
        }
        
        const timestamps = this.sessions.get(sessionId);
        
        // Remove timestamps older than 1 minute
        const oneMinuteAgo = now - 60 * 1000;
        const tenSecondsAgo = now - 10 * 1000;
        
        // Filter to keep only recent timestamps
        const recentTimestamps = timestamps.filter(ts => ts > oneMinuteAgo);
        this.sessions.set(sessionId, recentTimestamps);
        
        // Count messages in last minute and last 10 seconds
        const messagesInLastMinute = recentTimestamps.length;
        const messagesInLastTenSeconds = recentTimestamps.filter(ts => ts > tenSecondsAgo).length;
        
        // Debug logging (only if enabled)
        if (debugEnabled) {
            const sessionShort = sessionId.substring(0, 8);
            console.log(`🔍 Rate Limit Check [${sessionShort}]:`);
            console.log(`   📊 Last minute: ${messagesInLastMinute}/${this.limits.perMinute} messages`);
            console.log(`   ⚡ Last 10 sec: ${messagesInLastTenSeconds}/${this.limits.perTenSeconds} messages`);
            console.log(`   ✅ Status: ${messagesInLastMinute < this.limits.perMinute && messagesInLastTenSeconds < this.limits.perTenSeconds ? 'WITHIN LIMITS' : 'APPROACHING/EXCEEDED'}`);
        }
        
        // Check 10-second burst limit
        if (messagesInLastTenSeconds >= this.limits.perTenSeconds) {
            const oldestInBurst = recentTimestamps.filter(ts => ts > tenSecondsAgo)[0];
            const retryAfter = Math.ceil((oldestInBurst + 10 * 1000 - now) / 1000);
            
            if (debugEnabled) {
                console.log(`   ❌ BURST LIMIT EXCEEDED: ${messagesInLastTenSeconds}/${this.limits.perTenSeconds} in 10 seconds`);
                console.log(`   ⏱️  Retry after: ${retryAfter} seconds`);
            }
            
            return {
                allowed: false,
                retryAfter: Math.max(retryAfter, 1),
                reason: `burst_limit`,
                limit: this.limits.perTenSeconds,
                window: '10 seconds'
            };
        }
        
        // Check per-minute limit
        if (messagesInLastMinute >= this.limits.perMinute) {
            const oldestInMinute = recentTimestamps[0];
            const retryAfter = Math.ceil((oldestInMinute + 60 * 1000 - now) / 1000);
            
            if (debugEnabled) {
                console.log(`   ❌ RATE LIMIT EXCEEDED: ${messagesInLastMinute}/${this.limits.perMinute} in 1 minute`);
                console.log(`   ⏱️  Retry after: ${retryAfter} seconds`);
            }
            
            return {
                allowed: false,
                retryAfter: Math.max(retryAfter, 1),
                reason: `rate_limit`,
                limit: this.limits.perMinute,
                window: 'minute'
            };
        }
        
        // Rate limit passed - record this message
        recentTimestamps.push(now);
        this.sessions.set(sessionId, recentTimestamps);
        
        if (debugEnabled) {
            console.log(`   ✅ Request ALLOWED - Message recorded`);
            console.log(`   📈 New counts: ${messagesInLastMinute + 1}/${this.limits.perMinute} (minute), ${messagesInLastTenSeconds + 1}/${this.limits.perTenSeconds} (10sec)`);
        }
        
        return { allowed: true };
    }
    
    /**
     * Clean up old session data to prevent memory leaks
     */
    cleanup() {
        const now = Date.now();
        const fiveMinutesAgo = now - 5 * 60 * 1000;
        
        let cleaned = 0;
        for (const [sessionId, timestamps] of this.sessions.entries()) {
            // Remove sessions with no recent activity
            const recentTimestamps = timestamps.filter(ts => ts > fiveMinutesAgo);
            
            if (recentTimestamps.length === 0) {
                this.sessions.delete(sessionId);
                cleaned++;
            } else {
                this.sessions.set(sessionId, recentTimestamps);
            }
        }
        
        if (cleaned > 0) {
            console.log(`🧹 Rate limiter cleanup: removed ${cleaned} inactive sessions`);
        }
    }
    
    /**
     * Get current statistics (for monitoring)
     */
    getStats() {
        return {
            activeSessions: this.sessions.size,
            totalTimestamps: Array.from(this.sessions.values()).reduce((sum, arr) => sum + arr.length, 0)
        };
    }
}

// Create singleton rate limiter instance
const rateLimiter = new RateLimiter();

module.exports = rateLimiter;

