/**
 * PhillyGrind Branded Email Template
 * Table-based layout for maximum email client compatibility
 * Uses inline styles since many clients strip <style> tags
 */

export function createEmailTemplate({ subject, content, isCodeEmail = false, code = null }) {
  const codeBox = isCodeEmail && code ? `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td align="center" style="padding: 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background: #dcfce7; border-radius: 12px; padding: 24px 32px;">
            <tr>
              <td align="center">
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #15803d; line-height: 1.2;">
                  ${code}
                </div>
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; font-size: 14px; color: #6b7280; margin-top: 12px;">
                  This code expires in 5 minutes
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #0f172a; padding: 24px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; font-size: 24px; font-weight: bold; color: #ffffff;">
                      Philly<span style="color: #22c55e;">Grind</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 40px; color: #111827; line-height: 1.6;">
              ${codeBox}
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 40px; border-top: 1px solid #e5e7eb;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; font-size: 12px; color: #6b7280; line-height: 1.5;">
                      Sent by PhillyGrind — Philadelphia's local job, gig, and marketplace platform
                    </div>
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; font-size: 12px; color: #6b7280; margin-top: 12px;">
                      <a href="https://phillygrind.work" style="color: #22c55e; text-decoration: none;">phillygrind.work</a>
                      <span style="color: #d1d5db; margin: 0 8px;">•</span>
                      <a href="https://phillygrind.work/terms" style="color: #22c55e; text-decoration: none;">Terms</a>
                      <span style="color: #d1d5db; margin: 0 8px;">•</span>
                      <a href="https://phillygrind.work/privacy" style="color: #22c55e; text-decoration: none;">Privacy</a>
                    </div>
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; font-size: 11px; color: #9ca3af; margin-top: 16px;">
                      If you didn't request this email, you can safely ignore it.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function createTwoFactorEmail(code) {
  return createEmailTemplate({
    subject: 'Your PhillyGrind Verification Code',
    isCodeEmail: true,
    code,
    content: `
      <p style="margin: 0 0 16px 0;">Use the verification code above to complete your login request.</p>
      <p style="margin: 0;">For your security, never share this code with anyone.</p>
    `
  });
}

export function createContactEmail({ name, email, category, message, created_at }) {
  const categoryLabels = {
    general: 'General Inquiry',
    data_deletion: 'Data Deletion Request',
    fair_housing_complaint: 'Fair Housing Complaint',
    dispute_report: 'Dispute Report',
    other: 'Other',
  };

  return createEmailTemplate({
    subject: `New Contact Submission: ${categoryLabels[category] || category}`,
    content: `
      <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #111827;">New Contact Submission</h2>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 20px 0; background: #f9fafb; border-radius: 8px; padding: 16px;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>From:</strong></td>
          <td style="padding: 8px 0; color: #111827; font-size: 14px;">${name} &lt;${email}&gt;</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Category:</strong></td>
          <td style="padding: 8px 0; color: #111827; font-size: 14px;">${categoryLabels[category] || category}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Submitted:</strong></td>
          <td style="padding: 8px 0; color: #111827; font-size: 14px;">${new Date(created_at).toLocaleString()}</td>
        </tr>
      </table>
      <h3 style="margin: 24px 0 12px 0; font-size: 16px; color: #111827;">Message:</h3>
      <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${message}</p>
      </div>
      <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px;">
        <em>You can reply directly to ${email} to respond to this submission.</em>
      </p>
    `
  });
}

export function createExistingAccountEmail() {
  return createEmailTemplate({
    subject: 'Account Already Exists',
    content: `
      <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #111827;">Account Already Exists</h2>
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        Someone attempted to create a new PhillyGrind account using this email address.
      </p>
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        <strong>If this was you:</strong> You already have an account. Please log in or reset your password if needed.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 24px 0;">
        <tr>
          <td align="center" style="padding: 16px;">
            <a href="https://phillygrind.work/login" style="display: inline-block; background: #22c55e; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
              Log In to Your Account
            </a>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 8px 0;">
            <span style="color: #9ca3af; font-size: 14px;">or</span>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 16px;">
            <a href="https://phillygrind.work/reset-password" style="display: inline-block; background: #f3f4f6; color: #111827; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
              Reset Your Password
            </a>
          </td>
        </tr>
      </table>
      <p style="margin: 24px 0 0 0; color: #374151; font-size: 15px; line-height: 1.6;">
        <strong>If this wasn't you:</strong> No action is required. Your account remains secure.
      </p>
    `
  });
}
