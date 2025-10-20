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

