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
        
        // JSON body parser
        express.json()
    ];
}

module.exports = {
    setupMiddleware
};

