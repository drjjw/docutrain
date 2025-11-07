/**
 * Document serving route handlers
 * Handles root routes, goodbye page, and PHP compatibility routes
 */

const fs = require('fs');
const path = require('path');
const { serveIndexWithMetaTags } = require('../utils/documents-meta');

/**
 * Handle root route GET /
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
function handleRootRoute(req, res) {
    // If there's a doc parameter, redirect to /chat with the parameter
    if (req.query.doc) {
        const queryString = new URLSearchParams(req.query).toString();
        return res.redirect(`/chat?${queryString}`);
    }
    
    // Otherwise, serve the landing page
    const indexPath = path.join(__dirname, '../../public', 'index.html');
    res.sendFile(indexPath);
}

/**
 * Handle goodbye route GET /goodbye
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
function handleGoodbyeRoute(req, res) {
    const indexPath = path.join(__dirname, '../../public', 'index.html');
    let html = fs.readFileSync(indexPath, 'utf8');

    // Replace page title and content to show goodbye message
    html = html.replace(
        /<title>.*?<\/title>/,
        `<title>Thank You - AI Document Assistant</title>`
    );

    html = html.replace(
        /<meta name="description" content=".*?">/,
        `<meta name="description" content="Thank you for your interest in our AI document assistant. We understand you prefer not to proceed at this time. You are welcome to return whenever you wish."></meta>`
    );

    // Add a script to hide the document modal and show a goodbye message
    const goodbyeScript = `
        <script>
            // Hide document modal and show goodbye message on load
            document.addEventListener('DOMContentLoaded', function() {
                // Hide document selector overlay if present
                const overlay = document.getElementById('documentSelectorOverlay');
                if (overlay) overlay.style.display = 'none';

                // Hide input container and chat interface
                const inputContainer = document.querySelector('.input-container');
                const chatContainer = document.getElementById('chatContainer');

                if (inputContainer) inputContainer.style.display = 'none';
                if (chatContainer) chatContainer.style.display = 'none';

                // Hide the about icon since there's no document context
                const aboutIcon = document.getElementById('aboutIcon');
                if (aboutIcon) aboutIcon.style.display = 'none';

                // Update header to show goodbye message
                const headerTitle = document.getElementById('headerTitle');
                const headerSubtitle = document.getElementById('headerSubtitle');

                if (headerTitle) headerTitle.textContent = 'Thank You';
                if (headerSubtitle) headerSubtitle.textContent = 'You are welcome to return anytime';

                // Create and show goodbye message
                const goodbyeContainer = document.createElement('div');
                goodbyeContainer.style.cssText = \`
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    text-align: center;
                    padding: 2rem;
                    max-width: 500px;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                    z-index: 1000;
                \`;

                goodbyeContainer.innerHTML = \`
                    <h2 style="color: #333; margin-bottom: 1rem; font-size: 1.5rem;">Thank You for Your Interest</h2>
                    <p style="color: #666; line-height: 1.6; margin-bottom: 1.5rem;">
                        We understand you prefer not to proceed with the disclaimer at this time.
                        You are always welcome to return and explore our AI document assistant whenever you're ready.
                    </p>
                    <p style="color: #888; font-size: 0.9rem;">
                        Have a great day!
                    </p>
                \`;

                document.body.appendChild(goodbyeContainer);
            });
        </script>
        `;

    // Insert the goodbye script before the closing body tag
    html = html.replace('</body>', goodbyeScript + '</body>');

    res.send(html);
}

/**
 * Handle index.php route GET /index.php
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {object} documentRegistry - Document registry instance
 * @param {function} escapeHtml - HTML escaping function
 */
async function handleIndexPhpRoute(req, res, documentRegistry, escapeHtml) {
    const indexPath = path.join(__dirname, '../../public', 'index.html');
    await serveIndexWithMetaTags(req, res, indexPath, documentRegistry, escapeHtml);
}

/**
 * Handle PHP catch-all route GET *.php
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
function handlePhpCatchAll(req, res) {
    res.sendFile(path.join(__dirname, '../../public', 'index.html'));
}

module.exports = {
    handleRootRoute,
    handleGoodbyeRoute,
    handleIndexPhpRoute,
    handlePhpCatchAll
};

