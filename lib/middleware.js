/**
 * Express middleware configuration
 */

const cors = require('cors');
const express = require('express');

/**
 * Configure and return middleware array
 */
function setupMiddleware() {
    return [
        // Trust proxy headers from Apache (for proper HTTPS detection)
        (req, res, next) => {
            req.proxyAddress = req.headers['x-forwarded-for'] || req.ip;
            next();
        },
        
        // CORS - Allow embedding from any domain
        cors({
            origin: '*',
            credentials: true
        }),
        
        // Remove X-Frame-Options to allow iframe embedding
        (req, res, next) => {
            res.removeHeader('X-Frame-Options');
            next();
        },
        
        // JSON body parser (skip for multipart/form-data uploads)
        express.json({
            verify: (req, res, buf, encoding) => {
                // Skip JSON parsing for multipart requests (let multer handle them)
                if (req.headers['content-type']?.startsWith('multipart/form-data')) {
                    throw new Error('Skip JSON parsing for multipart');
                }
            }
        }).bind(null),
        
        // Error handler for skipped JSON parsing (multipart requests)
        (err, req, res, next) => {
            if (err.message === 'Skip JSON parsing for multipart') {
                // This is expected for multipart requests, continue without parsing
                next();
            } else {
                // Real error, pass it along
                next(err);
            }
        }
    ];
}

module.exports = {
    setupMiddleware
};

