import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from 'npm:resend@3';

// Initialize Supabase client with service role
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Get the base URL for the application
 */
function getBaseUrl(): string {
  const siteUrl = Deno.env.get('SITE_URL') || Deno.env.get('PUBLIC_BASE_URL') || 'https://docutrain.io';
  return siteUrl.replace(/\/$/, '');
}

/**
 * Get notification email template HTML
 */
function getNotificationEmailTemplate(
  ownerName: string,
  dashboardUrl: string
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You've Been Added to ${ownerName}</title>
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
        .dashboard-button {
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
        .dashboard-button:hover {
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
        .info-note {
            background-color: #f0f4ff;
            border-left: 4px solid #667eea;
            padding: 16px;
            margin: 24px 0;
            border-radius: 4px;
        }
        .info-note-text {
            font-size: 14px;
            color: #555555;
            margin: 0;
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
            <h2 class="email-title">Welcome to ${escapeHtml(ownerName)}!</h2>
            
            <p class="email-text">
                You've been added to the <strong>${escapeHtml(ownerName)}</strong> group on DocuTrain. You now have access to their documents and resources.
            </p>
            
            <div class="button-container">
                <a href="${escapeHtml(dashboardUrl)}" class="dashboard-button">Go to Dashboard</a>
            </div>
            
            <div class="info-note">
                <p class="info-note-text">
                    <strong>What's next?</strong> Log in to your DocuTrain account to start exploring the documents and resources available to you.
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

    const { email, owner_id } = await req.json();

    // Validate required fields
    if (!email || !owner_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'email and owner_id are required' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid email format' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    // Get owner information
    const { data: owner, error: ownerError } = await supabase
      .from('owners')
      .select('name, slug')
      .eq('id', owner_id)
      .single();

    if (ownerError || !owner) {
      console.error('Owner lookup error:', ownerError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to find owner information' }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    // Get sender email from environment
    const senderEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev';
    const senderName = Deno.env.get('RESEND_FROM_NAME') || 'DocuTrain';

    // Construct dashboard URL
    const baseUrl = getBaseUrl();
    const dashboardUrl = `${baseUrl}/app/dashboard`;

    // Generate email HTML
    const emailHtml = getNotificationEmailTemplate(owner.name, dashboardUrl);

    // Send email via Resend
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: `${senderName} <${senderEmail}>`,
      to: [email.toLowerCase().trim()],
      subject: `You've Been Added to ${owner.name} on DocuTrain`,
      html: emailHtml,
      text: `You've been added to the ${owner.name} group on DocuTrain. You now have access to their documents and resources.\n\nLog in to your account to get started: ${dashboardUrl}`,
    });

    if (emailError) {
      console.error('Resend API error:', emailError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to send notification email: ${emailError.message}` 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    console.log(`Notification sent successfully: ${email} -> ${owner.name} (${emailData?.id})`);

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

