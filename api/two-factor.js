import { getUserFromRequest, requireMethod, sendJson, supabaseAdmin } from './_utils.js';

const RESEND_API_URL = 'https://api.resend.com/emails';

function generateSixDigitCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;

  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      sendJson(res, 401, { error: 'Authentication required.' });
      return;
    }

    const { action } = req.body ?? {};

    if (action === 'send-code') {
      await handleSendCode(req, res, user);
      return;
    }

    if (action === 'verify-code') {
      await handleVerifyCode(req, res, user);
      return;
    }

    if (action === 'toggle-2fa') {
      await handleToggle2FA(req, res, user);
      return;
    }

    if (action === 'send-contact-email') {
      await handleSendContactEmail(req, res);
      return;
    }

    sendJson(res, 400, { error: 'A valid action is required (send-code, verify-code, toggle-2fa, or send-contact-email).' });
  } catch (error) {
    console.error('[2FA] Error:', error);
    sendJson(res, 500, { error: error.message || 'Failed to process 2FA request.' });
  }
}

async function handleSendCode(req, res, user) {
  if (!process.env.RESEND_API_KEY) {
    sendJson(res, 500, { error: 'RESEND_API_KEY is not configured.' });
    return;
  }

  const { email } = req.body ?? {};
  if (!email) {
    sendJson(res, 400, { error: 'Email is required.' });
    return;
  }

  // Invalidate previous unused codes for this user
  await supabaseAdmin
    .from('two_factor_codes')
    .update({ used: true })
    .eq('user_id', user.id)
    .eq('used', false);

  // Generate new code
  const code = generateSixDigitCode();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  // Store the code
  const { error: insertError } = await supabaseAdmin
    .from('two_factor_codes')
    .insert({
      user_id: user.id,
      code,
      expires_at: expiresAt,
    });

  if (insertError) {
    console.error('[2FA] Failed to store code:', insertError);
    sendJson(res, 500, { error: 'Failed to generate verification code.' });
    return;
  }

  // Send email
  const resendResponse = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'PhillyGrind <notifications@phillygrind.work>',
      to: email,
      subject: 'Your PhillyGrind Verification Code',
      html: `
        <h2>Your Verification Code</h2>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px;">${code}</p>
        <p>This code will expire in 5 minutes.</p>
        <p>If you didn't request this code, you can safely ignore this email.</p>
      `,
    }),
  });

  const payload = await resendResponse.json();
  console.log('[2FA] Resend response:', { status: resendResponse.status, payload });

  if (!resendResponse.ok) {
    console.error('[2FA] Resend API error:', payload);
    sendJson(res, resendResponse.status, { error: 'Failed to send verification code.', details: payload });
    return;
  }

  console.log('[2FA] Code sent successfully to:', email);
  sendJson(res, 200, { success: true });
}

async function handleVerifyCode(req, res, user) {
  const { code } = req.body ?? {};
  if (!code || code.length !== 6) {
    sendJson(res, 400, { error: 'A valid 6-digit code is required.' });
    return;
  }

  const now = new Date().toISOString();

  // Find valid, unused code for this user
  const { data: codeRecord, error: codeError } = await supabaseAdmin
    .from('two_factor_codes')
    .select('*')
    .eq('user_id', user.id)
    .eq('code', code)
    .eq('used', false)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (codeError) {
    console.error('[2FA] Failed to verify code:', codeError);
    sendJson(res, 500, { error: 'Failed to verify code.' });
    return;
  }

  if (!codeRecord) {
    sendJson(res, 400, { error: 'Invalid or expired code.' });
    return;
  }

  // Mark code as used
  const { error: updateError } = await supabaseAdmin
    .from('two_factor_codes')
    .update({ used: true })
    .eq('id', codeRecord.id);

  if (updateError) {
    console.error('[2FA] Failed to mark code as used:', updateError);
  }

  console.log('[2FA] Code verified successfully for user:', user.id);
  sendJson(res, 200, { success: true });
}

async function handleToggle2FA(req, res, user) {
  const { enabled, verifyCode } = req.body ?? {};

  if (typeof enabled !== 'boolean') {
    sendJson(res, 400, { error: 'enabled (boolean) is required.' });
    return;
  }

  // When enabling, require verification code
  if (enabled && verifyCode) {
    const now = new Date().toISOString();

    const { data: codeRecord, error: codeError } = await supabaseAdmin
      .from('two_factor_codes')
      .select('*')
      .eq('user_id', user.id)
      .eq('code', verifyCode)
      .eq('used', false)
      .gt('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (codeError || !codeRecord) {
      sendJson(res, 400, { error: 'Invalid or expired verification code.' });
      return;
    }

    // Mark code as used
    await supabaseAdmin
      .from('two_factor_codes')
      .update({ used: true })
      .eq('id', codeRecord.id);
  }

  // Update profile
  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ two_factor_enabled: enabled })
    .eq('id', user.id);

  if (updateError) {
    console.error('[2FA] Failed to toggle 2FA:', updateError);
    sendJson(res, 500, { error: 'Failed to update 2FA settings.' });
    return;
  }

  console.log('[2FA] 2FA toggled to:', enabled, 'for user:', user.id);
  sendJson(res, 200, { success: true, enabled });
}

async function handleSendContactEmail(req, res) {
  const { name, email, category, message, created_at } = req.body;

  console.log('[Contact Email] Received request:', { name, email, category, hasMessage: !!message });

  if (!name || !email || !category || !message) {
    console.error('[Contact Email] Missing required fields:', { name, email, category, message });
    sendJson(res, 400, { error: 'Missing required fields.' });
    return;
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('[Contact Email] RESEND_API_KEY is not configured');
    sendJson(res, 500, { error: 'RESEND_API_KEY is not configured.' });
    return;
  }

  const categoryLabels = {
    general: 'General Inquiry',
    data_deletion: 'Data Deletion Request',
    fair_housing_complaint: 'Fair Housing Complaint',
    dispute_report: 'Dispute Report',
    other: 'Other',
  };

  const emailPayload = {
    from: 'PhillyGrind <notifications@phillygrind.work>',
    to: 'drewnegron95@gmail.com',
    subject: `New Contact Submission: ${categoryLabels[category] || category}`,
    html: `
      <h2>New Contact Submission</h2>
      <p><strong>From:</strong> ${name} &lt;${email}&gt;</p>
      <p><strong>Category:</strong> ${categoryLabels[category] || category}</p>
      <p><strong>Submitted:</strong> ${new Date(created_at).toLocaleString()}</p>
      <hr />
      <h3>Message:</h3>
      <p style="white-space: pre-wrap;">${message}</p>
      <hr />
      <p><em>You can reply directly to ${email} to respond to this submission.</em></p>
    `,
  };

  console.log('[Contact Email] Sending to Resend:', { to: emailPayload.to, subject: emailPayload.subject });

  const resendResponse = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(emailPayload),
  });

  const payload = await resendResponse.json();
  console.log('[Contact Email] Resend response:', { status: resendResponse.status, payload });

  if (!resendResponse.ok) {
    console.error('[Contact Email] Resend API error:', { status: resendResponse.status, payload });
    sendJson(res, resendResponse.status, { error: 'Failed to send email notification.', details: payload });
    return;
  }

  console.log('[Contact Email] Email sent successfully:', payload.id);
  sendJson(res, 200, { success: true, messageId: payload.id });
}
