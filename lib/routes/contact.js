const express = require('express');
const { Resend } = require('resend');

/**
 * Create contact router for handling contact form submissions
 */
function createContactRouter() {
    const router = express.Router();
    
    // Initialize Resend client - check if API key exists first
    let resend;
    if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'your_resend_api_key_here') {
        try {
            resend = new Resend(process.env.RESEND_API_KEY);
            console.log('✓ Contact router: Resend client initialized');
        } catch (error) {
            console.error('❌ Contact router: Failed to initialize Resend client:', error.message);
            resend = null;
        }
    } else {
        console.warn('⚠️  Contact router: RESEND_API_KEY not configured');
    }

    /**
     * POST /api/contact
     * Handle contact form submission and send email via Resend
     */
    router.post('/contact', async (req, res) => {
        try {
            console.log('📧 Contact form submission received');
            const { name, email, subject, message } = req.body;

            // Validate required fields
            if (!name || !email || !subject || !message) {
                console.log('❌ Contact form: Missing required fields');
                return res.status(400).json({
                    success: false,
                    error: 'All fields are required'
                });
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                console.log('❌ Contact form: Invalid email format');
                return res.status(400).json({
                    success: false,
                    error: 'Invalid email address'
                });
            }

            // Check if Resend is configured
            if (!resend) {
                console.error('❌ Contact form: Resend not configured');
                return res.status(500).json({
                    success: false,
                    error: 'Email service not configured. Please contact support directly.'
                });
            }

            // Get the recipient email from environment or use a default
            // In test mode (onboarding@resend.dev), Resend only allows sending to verified email
            const senderEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
            const senderName = process.env.RESEND_FROM_NAME || 'DocuTrain Contact';
            const isTestMode = senderEmail.includes('onboarding@resend.dev');
            
            // Always use CONTACT_EMAIL if set, otherwise fall back appropriately
            const contactEmail = process.env.CONTACT_EMAIL;
            const verifiedEmail = process.env.RESEND_VERIFIED_EMAIL || 'docutrain@drjjw.com';
            
            // Priority: CONTACT_EMAIL if set, otherwise verified email in test mode, otherwise default
            const recipientEmail = contactEmail || (isTestMode ? verifiedEmail : 'contact@docutrain.io');
            
            if (isTestMode && recipientEmail !== verifiedEmail) {
                console.warn(`⚠️  Contact form: Test mode detected but CONTACT_EMAIL (${recipientEmail}) differs from verified email (${verifiedEmail}). Resend may reject this.`);
            }

            console.log(`📧 Contact form: Sending email from ${senderName} <${senderEmail}> to ${recipientEmail}${isTestMode ? ' (TEST MODE - using verified email)' : ''}`);

            // Construct logo URL - use public domain for emails (not localhost)
            // Priority: PUBLIC_BASE_URL env var > check if host is localhost/127.0.0.1 > use production domain
            let logoUrl;
            if (process.env.PUBLIC_BASE_URL) {
                logoUrl = `${process.env.PUBLIC_BASE_URL.replace(/\/$/, '')}/docutrain-logo.svg`;
            } else {
                const host = req.get('host') || '';
                const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('::1');
                
                if (isLocalhost) {
                    // Use production domain for emails (localhost URLs won't work in email clients)
                    logoUrl = 'https://docutrain.io/docutrain-logo.svg';
                } else {
                    // Use the actual host from the request
                    const protocol = req.protocol || 'https';
                    logoUrl = `${protocol}://${host}/docutrain-logo.svg`;
                }
            }

            // Send email via Resend
            // Note: In test mode, Resend only allows sending to your verified email address
            const { data, error } = await resend.emails.send({
                from: `${senderName} <${senderEmail}>`, // Include sender name in format "Name <email>"
                to: [recipientEmail],
                replyTo: email,
                subject: `Contact Form: ${subject}`,
                html: `
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>New Contact Form Submission</title>
                    </head>
                    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6; line-height: 1.6;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6; padding: 40px 20px;">
                            <tr>
                                <td align="center">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                                        <!-- Header with Logo -->
                                        <tr>
                                            <td style="background-color: #ffffff; padding: 40px 30px; text-align: center; border-bottom: 1px solid #e5e7eb;">
                                                <img src="${logoUrl}" alt="DocuTrain Logo" style="max-width: 200px; height: auto; margin-bottom: 16px;" />
                                                <h1 style="margin: 0; color: #111827; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">New Contact Form Submission</h1>
                                            </td>
                                        </tr>
                                        
                                        <!-- Contact Information Card -->
                                        <tr>
                                            <td style="padding: 30px;">
                                                <div style="background-color: #f9fafb; border-left: 4px solid #2563eb; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td style="padding-bottom: 12px;">
                                                                <strong style="color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Name</strong>
                                                                <p style="margin: 4px 0 0 0; color: #111827; font-size: 16px; font-weight: 500;">${escapeHtml(name)}</p>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="padding-bottom: 12px;">
                                                                <strong style="color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Email</strong>
                                                                <p style="margin: 4px 0 0 0; color: #2563eb; font-size: 16px;">
                                                                    <a href="mailto:${escapeHtml(email)}" style="color: #2563eb; text-decoration: none;">${escapeHtml(email)}</a>
                                                                </p>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td>
                                                                <strong style="color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Subject</strong>
                                                                <p style="margin: 4px 0 0 0; color: #111827; font-size: 16px; font-weight: 500;">${escapeHtml(subject)}</p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </div>
                                                
                                                <!-- Message Section -->
                                                <div style="margin-bottom: 30px;">
                                                    <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 18px; font-weight: 600;">Message</h2>
                                                    <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
                                                        <p style="margin: 0; color: #374151; font-size: 15px; white-space: pre-wrap; line-height: 1.7;">${escapeHtml(message)}</p>
                                                    </div>
                                                </div>
                                                
                                                <!-- Reply Button -->
                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                    <tr>
                                                        <td align="center" style="padding: 10px 0;">
                                                            <a href="mailto:${escapeHtml(email)}?subject=Re: ${escapeHtml(subject)}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 500; font-size: 15px;">Reply to ${escapeHtml(name)}</a>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                        
                                        <!-- Footer -->
                                        <tr>
                                            <td style="background-color: #f9fafb; padding: 20px 30px; border-top: 1px solid #e5e7eb;">
                                                <p style="margin: 0; color: #6b7280; font-size: 13px; text-align: center; line-height: 1.6;">
                                                    This message was sent from the <strong style="color: #374151;">DocuTrain</strong> contact form.<br>
                                                    <span style="color: #9ca3af;">You can reply directly to this email to respond to ${escapeHtml(name)}.</span>
                                                </p>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>
                    </body>
                    </html>
                `,
                text: `
New Contact Form Submission

Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}

---
This message was sent from the DocuTrain contact form.
                `
            });

            if (error) {
                console.error('❌ Contact form: Resend API error:', JSON.stringify(error, null, 2));
                console.error('   Error type:', typeof error);
                console.error('   Error keys:', Object.keys(error || {}));
                return res.status(500).json({
                    success: false,
                    error: `Failed to send email: ${error.message || JSON.stringify(error)}`
                });
            }

            console.log('✓ Contact form: Email sent successfully:', data?.id);

            res.json({
                success: true,
                message: 'Thank you for your message! We will get back to you soon.'
            });

        } catch (error) {
            console.error('❌ Contact form: Unexpected error:', error);
            console.error('   Error message:', error.message);
            console.error('   Error stack:', error.stack);
            res.status(500).json({
                success: false,
                error: 'An unexpected error occurred. Please try again later.'
            });
        }
    });

    return router;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

module.exports = { createContactRouter };

