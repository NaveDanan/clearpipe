// EmailJS Configuration
// Get these from https://www.emailjs.com/
// 1. Create account and verify email
// 2. Add an email service (Gmail, Outlook, etc.)
// 3. Create an email template with these EXACT variable names in your EmailJS template:
//    - {{to_name}} - recipient's name (derived from email)
//    - {{to_email}} - recipient's email address  
//    - {{from_name}} - inviter's name
//    - {{from_email}} - inviter's email (optional, for reply-to)
//    - {{message}} - the invitation message with link
//    - {{share_url}} - direct link to the shared pipeline
//    - {{pipeline_name}} - name of the pipeline being shared
// 4. Get your Public Key, Service ID, and Template ID from EmailJS dashboard

interface SendInviteEmailParams {
  to: string;
  inviterName: string;
  inviterEmail: string;
  pipelineName?: string;
  shareUrl: string;
}

export async function sendInviteEmail({
  to,
  inviterName,
  inviterEmail,
  pipelineName,
  shareUrl,
}: SendInviteEmailParams): Promise<{ success: boolean; error?: string; notConfigured?: boolean }> {
  // Debug: Log environment variable status (not values for security)
  console.log('EmailJS Config Check:', {
    hasPublicKey: !!process.env.EMAILJS_PUBLIC_KEY,
    hasServiceId: !!process.env.EMAILJS_SERVICE_ID,
    hasTemplateId: !!process.env.EMAILJS_TEMPLATE_ID,
  });

  // Get env vars at runtime (not at module load time for edge compatibility)
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;

  // Check if EmailJS is configured
  if (!publicKey || !serviceId || !templateId) {
    console.warn('EmailJS not configured. Missing:', {
      EMAILJS_PUBLIC_KEY: !publicKey,
      EMAILJS_SERVICE_ID: !serviceId,
      EMAILJS_TEMPLATE_ID: !templateId,
    });
    return { 
      success: false, 
      notConfigured: true,
      error: 'Email sending not configured. Please set EMAILJS_PUBLIC_KEY, EMAILJS_SERVICE_ID, and EMAILJS_TEMPLATE_ID environment variables.' 
    };
  }

  // Generate recipient name from email
  const toName = to.split('@')[0]
    .replace(/[._-]/g, ' ')
    .split(' ')
    .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const pipelineLabel = pipelineName || 'a ClearPipe pipeline';
  
  // Compose a friendly invitation message
  const message = `${inviterName} has invited you to collaborate on ${pipelineLabel}.\n\nClick the link below to access the shared pipeline:\n${shareUrl}`;

  try {
    // EmailJS REST API endpoint
    // Using the correct format for EmailJS REST API
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: {
          // Standard EmailJS template variables
          to_name: toName,
          to_email: to,
          from_name: inviterName,
          from_email: inviterEmail,
          reply_to: inviterEmail,
          message: message,
          // Custom variables for the template
          share_url: shareUrl,
          pipeline_name: pipelineLabel,
          inviter_name: inviterName,
          inviter_email: inviterEmail,
        },
      }),
    });

    // EmailJS returns "OK" on success, or an error message
    const responseText = await response.text();
    
    if (!response.ok) {
      console.error('EmailJS error response:', response.status, responseText);
      return { 
        success: false, 
        error: `EmailJS error (${response.status}): ${responseText}` 
      };
    }

    // Check if response is "OK" (EmailJS success response)
    if (responseText === 'OK') {
      console.log('Email sent successfully to:', to);
      return { success: true };
    }

    // If response is not "OK", it might be an error
    console.warn('Unexpected EmailJS response:', responseText);
    return { success: true }; // Still consider it success if status was 200

  } catch (error) {
    console.error('Error sending invite email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send email' 
    };
  }
}

// Export a function for client-side use (optional, for direct browser usage)
export function getEmailJSConfig() {
  return {
    publicKey: process.env.EMAILJS_PUBLIC_KEY,
    serviceId: process.env.EMAILJS_SERVICE_ID,
    templateId: process.env.EMAILJS_TEMPLATE_ID,
    isConfigured: !!(process.env.EMAILJS_PUBLIC_KEY && process.env.EMAILJS_SERVICE_ID && process.env.EMAILJS_TEMPLATE_ID),
  };
}

/**
 * EmailJS Template Setup Guide:
 * 
 * Create a template in EmailJS with the following content structure:
 * 
 * Subject: {{from_name}} invited you to collaborate on {{pipeline_name}}
 * 
 * To Email: {{to_email}}
 * 
 * Body (HTML):
 * ```
 * <h2>You've been invited to collaborate!</h2>
 * <p>Hi {{to_name}},</p>
 * <p>{{from_name}} ({{from_email}}) has invited you to collaborate on <strong>{{pipeline_name}}</strong>.</p>
 * <p>{{message}}</p>
 * <p><a href="{{share_url}}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Open Pipeline</a></p>
 * <p>Or copy this link: {{share_url}}</p>
 * <p>Best regards,<br>The ClearPipe Team</p>
 * ```
 * 
 * Required template variables:
 * - to_name: Recipient's name
 * - to_email: Recipient's email (for the "To" field)
 * - from_name: Sender's name
 * - from_email: Sender's email
 * - message: Full invitation message
 * - share_url: Link to the shared pipeline
 * - pipeline_name: Name of the pipeline
 */
