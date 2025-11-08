import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from 'npm:resend@3';

// Initialize Supabase client with service role
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Get the base URL for document links
 */
function getBaseUrl(): string {
  const siteUrl = Deno.env.get('SITE_URL') || Deno.env.get('PUBLIC_BASE_URL') || 'https://docutrain.io';
  return siteUrl.replace(/\/$/, '');
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Format processing time
 */
function formatProcessingTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format processing method for display
 */
function formatProcessingMethod(method: string): string {
  const methodMap: Record<string, string> = {
    'edge_function': 'Edge Function',
    'vps': 'VPS',
    'vps_fallback': 'VPS (Fallback)'
  };
  return methodMap[method] || method;
}

/**
 * Get success email template HTML
 */
function getSuccessEmailTemplate(
  documentTitle: string,
  documentUrl: string,
  stats?: {
    pages?: number;
    chunks?: number;
    processingTimeMs?: number;
  },
  processingMethod?: string
): string {
  const baseUrl = getBaseUrl();
  const fullDocumentUrl = documentUrl.startsWith('http') ? documentUrl : `${baseUrl}${documentUrl}`;
  
  let statsHtml = '';
  if (stats) {
    const statsItems: Array<{ label: string; value: string; icon: string }> = [];
    if (stats.pages) statsItems.push({ label: 'Pages processed', value: stats.pages.toString(), icon: '📄' });
    if (stats.processingTimeMs) {
      statsItems.push({ label: 'Processing time', value: formatProcessingTime(stats.processingTimeMs), icon: '⏱️' });
    }
    
    if (statsItems.length > 0) {
      statsHtml = `
        <div class="stats-box">
          <div class="stats-title">Processing Summary</div>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="stats-grid">
            <tr>
              ${statsItems.map(item => `
                <td class="stats-item-prominent">
                  <div class="stats-icon">${item.icon}</div>
                  <div class="stats-content">
                    <div class="stats-label">${item.label}</div>
                    <div class="stats-value">${item.value}</div>
                  </div>
                </td>
              `).join('')}
            </tr>
          </table>
        </div>
      `;
    }
  }
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document Processing Complete</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
        }
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
        }
        .email-header {
            background: #ffffff;
            padding: 40px 20px;
            text-align: center;
        }
        .logo {
            max-width: 200px;
            height: auto;
            margin-bottom: 20px;
        }
        .email-content {
            padding: 40px 30px;
        }
        .email-title {
            font-size: 28px;
            font-weight: 700;
            color: #1a1a1a;
            margin: 0 0 16px 0;
            text-align: center;
        }
        .email-text {
            font-size: 16px;
            color: #555555;
            margin: 0 0 24px 0;
            text-align: center;
        }
        .button-container {
            text-align: center;
            margin: 32px 0;
        }
        .view-button {
            display: inline-block;
            padding: 14px 32px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);
        }
        .view-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(102, 126, 234, 0.4);
        }
        .email-footer {
            padding: 30px;
            background-color: #f9f9f9;
            text-align: center;
            border-top: 1px solid #e5e5e5;
        }
        .footer-text {
            font-size: 14px;
            color: #888888;
            margin: 0 0 8px 0;
        }
        .footer-link {
            color: #667eea;
            text-decoration: none;
        }
        .info-box {
            background-color: #f0f9ff;
            border-left: 4px solid #3b82f6;
            padding: 16px;
            margin: 24px 0;
            border-radius: 4px;
        }
        .info-box-text {
            font-size: 14px;
            color: #555555;
            margin: 0;
        }
        .stats-box {
            background-color: #f9fafb;
            border: 1px solid #e5e7eb;
            padding: 30px;
            margin: 24px 0;
            border-radius: 8px;
        }
        .stats-title {
            font-size: 18px;
            font-weight: 600;
            color: #1a1a1a;
            margin: 0 0 20px 0;
            text-align: center;
        }
        .stats-grid {
            display: table;
            width: 100%;
            table-layout: fixed;
        }
        .stats-item-prominent {
            display: table-cell;
            width: 50%;
            text-align: center;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
            vertical-align: top;
        }
        .stats-icon {
            font-size: 32px;
            margin-bottom: 12px;
        }
        .stats-label {
            font-size: 14px;
            color: #6b7280;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .stats-value {
            font-size: 28px;
            font-weight: 700;
            color: #1a1a1a;
        }
        .success-icon {
            text-align: center;
            margin-bottom: 16px;
        }
        .success-icon div {
            width: 64px;
            height: 64px;
            margin: 0 auto;
            background-color: #10b981;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 36px;
            color: white;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <!-- Header with Logo -->
        <div class="email-header">
            <img src="https://www.docutrain.io/docutrain-logo.png" alt="DocuTrain Logo" class="logo">
        </div>
        
        <!-- Main Content -->
        <div class="email-content">
            <div class="success-icon">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                    <tr>
                        <td style="width: 64px; height: 64px; background-color: #10b981; border-radius: 50%; text-align: center; vertical-align: middle; font-size: 36px; color: white; font-weight: bold; line-height: 64px;">✓</td>
                    </tr>
                </table>
            </div>
            <h2 class="email-title">Document Processing Complete!</h2>
            
            <p class="email-text">
                Your document <strong>${escapeHtml(documentTitle)}</strong> has been successfully processed and is now ready to use.
            </p>
            
            ${statsHtml}
            
            <div class="button-container">
                <a href="${escapeHtml(fullDocumentUrl)}" class="view-button">View Document</a>
            </div>
            
            <div class="info-box">
                <p class="info-box-text">
                    <strong>What's next?</strong> You can now ask questions about this document in your DocuTrain chat interface. The document has been indexed and is ready for AI-powered queries.
                </p>
            </div>
        </div>
        
        <!-- Footer -->
        <div class="email-footer">
            <p class="footer-text">
                This email was sent by DocuTrain.<br>
                If you have any questions, please contact our support team.
            </p>
        </div>
    </div>
</body>
</html>
  `;
}

/**
 * Get failure email template HTML
 */
function getFailureEmailTemplate(
  documentTitle: string,
  errorMessage: string,
  documentUrl?: string,
  errorDetails?: string,
  processingMethod?: string
): string {
  const baseUrl = getBaseUrl();
  const fullDocumentUrl = documentUrl ? (documentUrl.startsWith('http') ? documentUrl : `${baseUrl}${documentUrl}`) : null;
  
  let errorDetailsHtml = '';
  if (errorDetails) {
    errorDetailsHtml = `
      <div class="error-details">
        ${escapeHtml(errorDetails)}
      </div>
    `;
  }
  
  let processingMethodHtml = '';
  if (processingMethod) {
    let methodDescription = '';
    if (processingMethod === 'edge_function') {
      methodDescription = 'The system attempted to process via Edge Function but encountered an error.';
    } else if (processingMethod === 'vps') {
      methodDescription = 'The system attempted to process via VPS but encountered an error.';
    } else if (processingMethod === 'vps_fallback') {
      methodDescription = 'The system fell back to VPS processing after Edge Function failed, but encountered an error.';
    }
    
    if (methodDescription) {
      processingMethodHtml = `
        <div class="help-box">
          <p class="help-box-text">
            <strong>Processing Method:</strong> ${formatProcessingMethod(processingMethod)}<br>
            ${methodDescription}
          </p>
        </div>
      `;
    }
  }
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document Processing Failed</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
        }
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
        }
        .email-header {
            background: #ffffff;
            padding: 40px 20px;
            text-align: center;
        }
        .logo {
            max-width: 200px;
            height: auto;
            margin-bottom: 20px;
        }
        .email-content {
            padding: 40px 30px;
        }
        .email-title {
            font-size: 28px;
            font-weight: 700;
            color: #1a1a1a;
            margin: 0 0 16px 0;
            text-align: center;
        }
        .email-text {
            font-size: 16px;
            color: #555555;
            margin: 0 0 24px 0;
            text-align: center;
        }
        .button-container {
            text-align: center;
            margin: 32px 0;
        }
        .retry-button {
            display: inline-block;
            padding: 14px 32px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);
        }
        .retry-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(102, 126, 234, 0.4);
        }
        .email-footer {
            padding: 30px;
            background-color: #f9f9f9;
            text-align: center;
            border-top: 1px solid #e5e5e5;
        }
        .footer-text {
            font-size: 14px;
            color: #888888;
            margin: 0 0 8px 0;
        }
        .footer-link {
            color: #667eea;
            text-decoration: none;
        }
        .error-box {
            background-color: #fef2f2;
            border-left: 4px solid #ef4444;
            padding: 16px;
            margin: 24px 0;
            border-radius: 4px;
        }
        .error-box-text {
            font-size: 14px;
            color: #555555;
            margin: 0;
        }
        .help-box {
            background-color: #f0f4ff;
            border-left: 4px solid #667eea;
            padding: 16px;
            margin: 24px 0;
            border-radius: 4px;
        }
        .help-box-text {
            font-size: 14px;
            color: #555555;
            margin: 0;
        }
        .error-icon {
            text-align: center;
            margin-bottom: 16px;
        }
        .error-icon div {
            width: 64px;
            height: 64px;
            margin: 0 auto;
            background-color: #ef4444;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 36px;
            color: white;
            font-weight: bold;
        }
        .error-details {
            background-color: #f9fafb;
            border: 1px solid #e5e7eb;
            padding: 16px;
            margin: 24px 0;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            color: #666666;
            word-break: break-word;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <!-- Header with Logo -->
        <div class="email-header">
            <img src="https://www.docutrain.io/docutrain-logo.png" alt="DocuTrain Logo" class="logo">
        </div>
        
        <!-- Main Content -->
        <div class="email-content">
            <div class="error-icon">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                    <tr>
                        <td style="width: 64px; height: 64px; background-color: #ef4444; border-radius: 50%; text-align: center; vertical-align: middle; font-size: 36px; color: white; font-weight: bold; line-height: 64px;">!</td>
                    </tr>
                </table>
            </div>
            <h2 class="email-title">Document Processing Failed</h2>
            
            <p class="email-text">
                We encountered an issue while processing your document <strong>${escapeHtml(documentTitle)}</strong>.
            </p>
            
            <div class="error-box">
                <p class="error-box-text">
                    <strong>Error:</strong> ${escapeHtml(errorMessage)}
                </p>
            </div>
            
            ${errorDetailsHtml}
            
            ${fullDocumentUrl ? `
            <div class="button-container">
                <a href="${escapeHtml(fullDocumentUrl)}" class="retry-button">View Document & Retry</a>
            </div>
            ` : ''}
            
            <div class="help-box">
                <p class="help-box-text">
                    <strong>What can you do?</strong><br>
                    • Try uploading the document again<br>
                    • Check that the file format is supported (PDF, DOCX, TXT)<br>
                    • Ensure the file is not corrupted or password-protected<br>
                    • Contact support if the issue persists
                </p>
            </div>
            
            ${processingMethodHtml}
        </div>
        
        <!-- Footer -->
        <div class="email-footer">
            <p class="footer-text">
                This email was sent by DocuTrain.<br>
                If you have any questions, please contact our support team.
            </p>
        </div>
    </div>
</body>
</html>
  `;
}

/**
 * Edge Function handler
 */
Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Check for RESEND_API_KEY at runtime
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('RESEND_API_KEY is not set in environment variables');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Email service configuration error. Please contact support.' 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }
    const resend = new Resend(resendApiKey);

    const { 
      user_id, 
      document_title, 
      document_url, 
      status, // 'success' or 'failure'
      error_message,
      error_details,
      stats, // { pages, chunks, processingTimeMs }
      processing_method // 'edge_function', 'vps', 'vps_fallback'
    } = await req.json();

    // Validate required fields
    if (!user_id || !document_title || !status) {
      return new Response(
        JSON.stringify({ success: false, error: 'user_id, document_title, and status are required' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    // Validate status
    if (status !== 'success' && status !== 'failure') {
      return new Response(
        JSON.stringify({ success: false, error: 'status must be "success" or "failure"' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    // Get user email from auth
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(user_id);
    
    if (userError || !userData?.user?.email) {
      console.error('User lookup error:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to find user email' }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    const userEmail = userData.user.email;

    // Get sender email from environment
    const senderEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev';
    const senderName = Deno.env.get('RESEND_FROM_NAME') || 'DocuTrain';

    // Generate email HTML based on status
    let emailHtml: string;
    let subject: string;
    let textContent: string;

    if (status === 'success') {
      emailHtml = getSuccessEmailTemplate(document_title, document_url || '/app/documents', stats, processing_method);
      subject = `Document Processing Complete: ${document_title}`;
      textContent = `Your document "${document_title}" has been successfully processed and is now ready to use.\n\n${document_url ? `View it here: ${document_url.startsWith('http') ? document_url : `${getBaseUrl()}${document_url}`}` : ''}`;
    } else {
      emailHtml = getFailureEmailTemplate(
        document_title, 
        error_message || 'An unknown error occurred', 
        document_url,
        error_details,
        processing_method
      );
      subject = `Document Processing Failed: ${document_title}`;
      textContent = `We encountered an issue while processing your document "${document_title}".\n\nError: ${error_message || 'An unknown error occurred'}\n\n${document_url ? `View it here: ${document_url.startsWith('http') ? document_url : `${getBaseUrl()}${document_url}`}` : ''}`;
    }

    console.log(`Sending processing notification email: status="${status}" to="${userEmail}" document="${document_title}"`);

    // Send email via Resend
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: `${senderName} <${senderEmail}>`,
      to: [userEmail.toLowerCase().trim()],
      bcc: ['drjweinstein@gmail.com'],
      subject: subject,
      html: emailHtml,
      text: textContent,
    });

    if (emailError) {
      console.error('Resend API error:', emailError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to send email: ${emailError.message}` 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    console.log(`Processing notification sent successfully: ${userEmail} -> ${document_title} (${emailData?.id})`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        email_id: emailData?.id 
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      }
    );

  } catch (error) {
    console.error('Edge Function error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      }
    );
  }
});

