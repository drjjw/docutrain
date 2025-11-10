import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from 'npm:resend@3';

// Initialize Supabase client with service role
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Generate a secure random token for invitation
 */
function generateInviteToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Get the base URL for signup links
 */
function getBaseUrl(): string {
  const siteUrl = Deno.env.get('SITE_URL') || Deno.env.get('PUBLIC_BASE_URL') || 'https://docutrain.io';
  return siteUrl.replace(/\/$/, '');
}

/**
 * Get email template HTML
 */
function getInvitationEmailTemplate(
  ownerName: string,
  signupUrl: string
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You're Invited to Join ${ownerName}</title>
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
        .signup-button {
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
        .signup-button:hover {
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
        .security-note {
            background-color: #f0f4ff;
            border-left: 4px solid #667eea;
            padding: 16px;
            margin: 24px 0;
            border-radius: 4px;
        }
        .security-note-text {
            font-size: 14px;
            color: #555555;
            margin: 0;
        }
        .link-fallback {
            margin-top: 24px;
            padding-top: 24px;
            border-top: 1px solid #e5e5e5;
        }
        .link-fallback-text {
            font-size: 14px;
            color: #888888;
            margin: 0 0 8px 0;
            word-break: break-all;
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
            <h2 class="email-title">You're Invited!</h2>
            
            <p class="email-text">
                You've been invited to join <strong>${escapeHtml(ownerName)}</strong> on DocuTrain. Click the button below to create your account and get started:
            </p>
            
            <div class="button-container">
                <a href="${escapeHtml(signupUrl)}" class="signup-button">Create Account</a>
            </div>
            
            <div class="security-note">
                <p class="security-note-text">
                    <strong>Important:</strong> This invitation link will expire in 30 days for your security. If you didn't expect this invitation, please ignore this email.
                </p>
            </div>
            
            <div class="link-fallback">
                <p class="link-fallback-text">
                    If the button doesn't work, copy and paste this link into your browser:<br>
                    <a href="${escapeHtml(signupUrl)}" class="footer-link">${escapeHtml(signupUrl)}</a>
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

    const { email, owner_id, role, invited_by_user_id } = await req.json();
    const userRole = role || 'registered'; // Default to registered

    // Validate required fields
    if (!email || !invited_by_user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'email and invited_by_user_id are required' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    // Validate role
    if (!['registered', 'owner_admin'].includes(userRole)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid role. Must be "registered" or "owner_admin"' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    // Validate role/owner_id combinations
    if (userRole === 'owner_admin' && !owner_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'owner_id is required for owner_admin role' }),
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

    // Generate invite token
    const inviteToken = generateInviteToken();

    // Calculate expiration (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Create invitation record in database
    const { data: invitation, error: dbError } = await supabase
      .from('user_invitations')
      .insert({
        email: email.toLowerCase().trim(),
        invite_token: inviteToken,
        owner_id: owner_id || null,
        role: userRole,
        invited_by: invited_by_user_id,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to create invitation: ${dbError.message}` }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    // Get owner information (only if owner_id is provided)
    let owner = null;
    if (owner_id) {
      const { data: ownerData, error: ownerError } = await supabase
        .from('owners')
        .select('name, slug')
        .eq('id', owner_id)
        .single();

      if (ownerError || !ownerData) {
        console.error('Owner lookup error:', ownerError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to find owner information' }),
          { 
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          }
        );
      }
      owner = ownerData;
    }

    // Get sender email from environment
    const senderEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev';
    const senderName = Deno.env.get('RESEND_FROM_NAME') || 'DocuTrain';

    console.log(`Sending invitation email: from="${senderName} <${senderEmail}>" to="${email.toLowerCase().trim()}"`);

    // Construct signup URL
    const baseUrl = getBaseUrl();
    const signupUrl = `${baseUrl}/app/signup?invite_token=${inviteToken}`;

    // Generate email HTML (use owner name or generic message)
    const ownerName = owner?.name || 'DocuTrain';
    const emailHtml = getInvitationEmailTemplate(ownerName, signupUrl);

    // Send email via Resend
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: `${senderName} <${senderEmail}>`,
      to: [email.toLowerCase().trim()],
      subject: owner ? `You're Invited to Join ${owner.name} on DocuTrain` : 'You\'re Invited to Join DocuTrain',
      html: emailHtml,
      text: owner 
        ? `You've been invited to join ${owner.name} on DocuTrain. Click the link below to create your account:\n\n${signupUrl}\n\nThis invitation will expire in 30 days.`
        : `You've been invited to join DocuTrain. Click the link below to create your account:\n\n${signupUrl}\n\nThis invitation will expire in 30 days.`,
    });

    if (emailError) {
      console.error('Resend API error:', emailError);
      // Still return success since invitation was created, but log the error
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Invitation created but failed to send email: ${emailError.message}`,
          invitation_id: invitation.id 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    console.log(`Invitation sent successfully: ${email} -> ${owner ? owner.name : 'DocuTrain (no owner group)'} (${emailData?.id})`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        invitation_id: invitation.id,
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

