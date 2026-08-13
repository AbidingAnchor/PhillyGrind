import { requireMethod, sendJson } from './_utils.js';

const RESEND_API_URL = 'https://api.resend.com/emails';

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;

  try {
    const { name, email, category, message, created_at } = req.body;

    if (!name || !email || !category || !message) {
      sendJson(res, 400, { error: 'Missing required fields.' });
      return;
    }

    if (!process.env.RESEND_API_KEY) {
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

    const resendResponse = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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
      }),
    });

    const payload = await resendResponse.json();
    if (!resendResponse.ok) {
      console.error('Resend API error:', payload);
      sendJson(res, resendResponse.status, { error: 'Failed to send email notification.' });
      return;
    }

    sendJson(res, 200, { success: true, messageId: payload.id });
  } catch (error) {
    console.error('Contact email error:', error);
    sendJson(res, 500, { error: 'Failed to send email notification.' });
  }
}
