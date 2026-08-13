import { requireMethod, sendJson } from './_utils.js';

const RESEND_API_URL = 'https://api.resend.com/emails';

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;

  try {
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
      from: 'PhillyGrind <noreply@phillygrind.work>',
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
  } catch (error) {
    console.error('[Contact Email] Unexpected error:', error);
    sendJson(res, 500, { error: 'Failed to send email notification.', details: error.message });
  }
}
