const FROM_ADDRESS = 'PhillyGrind <noreply@phillygrind.com>';

export async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('RESEND_API_KEY missing; skipping email to', to);
    return { skipped: true };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Email failed (${response.status}): ${body}`);
  }

  return response.json();
}

export function emailShell(title, bodyHtml) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #061524 0%, #1a3a2a 100%); padding: 30px; border-radius: 10px; margin-bottom: 20px;">
    <h1 style="color: white; margin: 0; font-size: 28px;">PhillyGrind</h1>
  </div>
  ${bodyHtml}
</body>
</html>`;
}
