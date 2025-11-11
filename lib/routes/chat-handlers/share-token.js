/**
 * Share Token Utilities
 * Generate and manage secure share tokens for conversations
 */

const crypto = require('crypto');

/**
 * Generate a secure, URL-safe share token for conversations
 * Uses crypto.randomBytes for cryptographically secure randomness
 * @returns {string} URL-safe base64 token (32 bytes = 43 chars)
 */
function generateShareToken() {
    // Generate 32 random bytes (256 bits) for strong security
    const randomBytes = crypto.randomBytes(32);
    // Convert to URL-safe base64 (replaces + with -, / with _, removes padding)
    return randomBytes.toString('base64url');
}

module.exports = {
    generateShareToken
};

