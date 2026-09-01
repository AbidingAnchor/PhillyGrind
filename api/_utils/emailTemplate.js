/**
 * PhillyGrind Branded Email Template
 * Table-based layout for maximum email client compatibility
 * Uses inline styles since many clients strip <style> tags
 */

import { createUnsubscribeUrl } from './unsubscribe.js';

export function createEmailTemplate({
  subject,
  content,
  isCodeEmail = false,
  code = null,
  userId = null,
  unsubscribeUrl = null,
}) {
  const resolvedUnsubscribeUrl = unsubscribeUrl
    || (userId ? createUnsubscribeUrl(userId) : '');
  const unsubscribeLink = resolvedUnsubscribeUrl ? `
                      <span style="color: #d1d5db; margin: 0 8px;">•</span>
                      <a href="${resolvedUnsubscribeUrl}" style="color: #22c55e; text-decoration: none;">Unsubscribe</a>` : '';

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
                      <a href="https://phillygrind.work/privacy" style="color: #22c55e; text-decoration: none;">Privacy</a>${unsubscribeLink}
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

export function createAccountRecoveryApprovedEmail({ resetUrl }) {
  return createEmailTemplate({
    subject: 'Set a new PhillyGrind password',
    content: `
      <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #111827;">Set a new password</h2>
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        We verified an account recovery request. Use the button below to choose a new password. This also switches your login email to this inbox.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 24px 0;">
        <tr>
          <td align="center" style="padding: 16px;">
            <a href="${encodeURI(resetUrl)}" style="display: inline-block; background: #22c55e; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
              Set new password
            </a>
          </td>
        </tr>
      </table>
      <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
        This link works once and expires in 24 hours. If you did not ask to recover a PhillyGrind account, ignore this email.
      </p>
    `,
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function createCommentOnPostEmail({ commenterName, commentPreview, postUrl, settingsUrl, userId }) {
  const safeName = escapeHtml(commenterName);
  const safePreview = escapeHtml(commentPreview);
  const subject = `${String(commenterName || 'Someone').replace(/\s+/g, ' ').trim()} commented on your post`;

  return {
    subject,
    html: createEmailTemplate({
      subject: escapeHtml(subject),
      userId,
      content: `
      <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #111827;">New comment on your post</h2>
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        <strong>${safeName}</strong> commented on your Community post:
      </p>
      <div style="background: #f9fafb; border-left: 4px solid #22c55e; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${safePreview}</p>
      </div>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 24px 0;">
        <tr>
          <td align="center" style="padding: 8px 0;">
            <a href="${postUrl}" style="display: inline-block; background: #22c55e; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
              View post
            </a>
          </td>
        </tr>
      </table>
      <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
        You can turn off comment emails in
        <a href="${settingsUrl}" style="color: #22c55e; text-decoration: none;">Settings</a>.
      </p>
    `,
    }),
  };
}

export function createAccountRecoveryDeniedEmail() {
  return createEmailTemplate({
    subject: 'PhillyGrind account recovery update',
    content: `
      <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #111827;">We could not verify this request</h2>
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        We weren't able to verify ownership of this account with the information provided. If this is your account, you can try again or reach out to our support team directly.
      </p>
      <p style="margin: 0; color: #6b7280; font-size: 14px;">
        Support: support@phillygrind.work
      </p>
    `,
  });
}

export function createWeatherAlertEmail({ alertType, neighborhood, description, expires, alertUrl, settingsUrl, userId }) {
  const safeAlertType = escapeHtml(alertType || 'Weather Alert');
  const safeNeighborhood = escapeHtml(neighborhood || 'your area');
  const safeDescription = escapeHtml(description || '');
  const safeExpires = escapeHtml(expires || '');
  const subject = `${safeAlertType} in ${safeNeighborhood}`;

  return {
    subject,
    html: createEmailTemplate({
      subject: escapeHtml(subject),
      userId,
      content: `
      <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #111827;">${safeAlertType} in ${safeNeighborhood}</h2>
      ${safeDescription ? `
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0; color: #92400e; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${safeDescription}</p>
      </div>
      ` : ''}
      ${safeExpires ? `
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        <strong>Expires:</strong> ${safeExpires}
      </p>
      ` : ''}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 24px 0;">
        <tr>
          <td align="center" style="padding: 8px 0;">
            <a href="${alertUrl}" style="display: inline-block; background: #22c55e; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
              View Alert Details
            </a>
          </td>
        </tr>
      </table>
      <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
        You can turn off weather alert emails in
        <a href="${settingsUrl}" style="color: #22c55e; text-decoration: none;">Settings</a>.
      </p>
    `,
    }),
  };
}

export function createWeeklyDigestEmail({ neighborhood, jobs, gigs, communityPosts, siteUrl, userId }) {
  const safeNeighborhood = escapeHtml(neighborhood || 'your area');
  const subject = `What's new in ${safeNeighborhood} this week`;
  
  const jobItems = (jobs || []).slice(0, 3).map(job => `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
        <a href="${siteUrl}/jobs/${job.id}" style="color: #111827; text-decoration: none; font-weight: 600; font-size: 15px;">
          ${escapeHtml(job.title)}
        </a>
        <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">${escapeHtml(job.company || '')}</p>
      </td>
    </tr>
  `).join('');

  const gigItems = (gigs || []).slice(0, 3).map(gig => `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
        <a href="${siteUrl}/gigs/${gig.id}" style="color: #111827; text-decoration: none; font-weight: 600; font-size: 15px;">
          ${escapeHtml(gig.title)}
        </a>
        <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">${escapeHtml(gig.pay || '')}</p>
      </td>
    </tr>
  `).join('');

  const communityItems = (communityPosts || []).slice(0, 3).map(post => `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
        <a href="${siteUrl}/?post=${encodeURIComponent(post.id)}" style="color: #111827; text-decoration: none; font-weight: 600; font-size: 15px;">
          ${escapeHtml(post.content?.slice(0, 60) || 'Community post')}
        </a>
        <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">${post.like_count || 0} likes</p>
      </td>
    </tr>
  `).join('');

  const totalItems = (jobs?.length || 0) + (gigs?.length || 0) + (communityPosts?.length || 0);

  return {
    subject,
    html: createEmailTemplate({
      subject: escapeHtml(subject),
      userId,
      content: `
      <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #111827;">What's new in ${safeNeighborhood} this week</h2>
      <p style="margin: 0 0 24px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        Here are ${totalItems} new opportunities and conversations from your neighborhood this week.
      </p>

      ${jobs?.length ? `
      <h3 style="margin: 24px 0 12px 0; font-size: 16px; color: #111827;">New Jobs (${jobs.length})</h3>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        ${jobItems}
      </table>
      ` : ''}

      ${gigs?.length ? `
      <h3 style="margin: 24px 0 12px 0; font-size: 16px; color: #111827;">New Gigs (${gigs.length})</h3>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        ${gigItems}
      </table>
      ` : ''}

      ${communityPosts?.length ? `
      <h3 style="margin: 24px 0 12px 0; font-size: 16px; color: #111827;">Community Posts (${communityPosts.length})</h3>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        ${communityItems}
      </table>
      ` : ''}

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 32px 0;">
        <tr>
          <td align="center" style="padding: 8px 0;">
            <a href="${siteUrl}/" style="display: inline-block; background: #22c55e; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
              Explore More on PhillyGrind
            </a>
          </td>
        </tr>
      </table>

      <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
        <a href="${siteUrl}/settings?action=unsubscribe-digest" style="color: #22c55e; text-decoration: none;">Unsubscribe from weekly digest</a>
      </p>
    `,
    }),
  };
}
