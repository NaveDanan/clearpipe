// EmailJS Configuration
// Get these from https://www.emailjs.com/
// 1. Create account and verify email
// 2. Add an email service (Gmail, Outlook, etc.)
// 3. Create an email template with variables: {{to_email}}, {{inviter_name}}, {{inviter_email}}, {{share_url}}, {{pipeline_name}}
// 4. Get your Public Key, Service ID, and Template ID

const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY;
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;

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
}: SendInviteEmailParams): Promise<{ success: boolean; error?: string }> {
  // Check if EmailJS is configured
  if (!EMAILJS_PUBLIC_KEY || !EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID) {
    console.warn('EmailJS not configured. Set EMAILJS_PUBLIC_KEY, EMAILJS_SERVICE_ID, and EMAILJS_TEMPLATE_ID in .env.local');
    return { 
      success: true, 
      error: 'Email sending not configured (EmailJS credentials not set)' 
    };
  }

  try {
    // EmailJS REST API endpoint
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: {
          to_email: to,
          inviter_name: inviterName,
          inviter_email: inviterEmail,
          pipeline_name: pipelineName || 'a pipeline',
          share_url: shareUrl,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('EmailJS error:', errorText);
      return { success: false, error: `EmailJS error: ${errorText}` };
    }

    return { success: true };
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
    publicKey: EMAILJS_PUBLIC_KEY,
    serviceId: EMAILJS_SERVICE_ID,
    templateId: EMAILJS_TEMPLATE_ID,
    isConfigured: !!(EMAILJS_PUBLIC_KEY && EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID),
  };
}
