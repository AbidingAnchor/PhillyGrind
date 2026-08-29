import { hasServerSupabaseConfig, supabaseAdmin } from './_utils.js';
import { verifyUnsubscribeToken } from './_utils/unsubscribe.js';

function page({ title, heading, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;background:#f3f4f6;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f3f4f6;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="480" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#0f172a;padding:24px 32px;text-align:center;">
              <div style="font-size:24px;font-weight:bold;color:#ffffff;">Philly<span style="color:#22c55e;">Grind</span></div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 36px;color:#111827;line-height:1.6;">
              <h1 style="margin:0 0 12px 0;font-size:22px;">${heading}</h1>
              <p style="margin:0;color:#374151;font-size:15px;">${body}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 36px 32px;text-align:center;">
              <a href="https://phillygrind.work" style="color:#16a34a;text-decoration:none;font-size:14px;font-weight:600;">Back to PhillyGrind</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function sendHtml(res, status, html) {
  res.status(status);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(html);
}

async function unsubscribeUser(req, res) {
  const token = typeof req.query?.token === 'string' ? req.query.token : '';
  const userId = verifyUnsubscribeToken(token);

  if (!userId) {
    sendHtml(res, 400, page({
      title: 'Unsubscribe — PhillyGrind',
      heading: 'This unsubscribe link is invalid',
      body: 'The link may be incomplete or expired. If you still receive emails from us, reply to that message or contact support@phillygrind.work.',
    }));
    return;
  }

  if (!hasServerSupabaseConfig) {
    sendHtml(res, 500, page({
      title: 'Unsubscribe — PhillyGrind',
      heading: 'Something went wrong',
      body: 'We could not update your email preferences right now. Please try again in a few minutes.',
    }));
    return;
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ unsubscribed: true })
    .eq('id', userId);

  if (error) {
    console.error('[unsubscribe] Failed to update profile:', error);
    sendHtml(res, 500, page({
      title: 'Unsubscribe — PhillyGrind',
      heading: 'Something went wrong',
      body: 'We could not update your email preferences right now. Please try again in a few minutes.',
    }));
    return;
  }

  sendHtml(res, 200, page({
    title: 'Unsubscribed — PhillyGrind',
    heading: "You're unsubscribed",
    body: "You won't receive marketing emails from PhillyGrind anymore. Transactional mail such as login codes and account recovery may still be sent when needed.",
  }));
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    sendHtml(res, 405, page({
      title: 'Unsubscribe — PhillyGrind',
      heading: 'Method not allowed',
      body: 'Open this page from the unsubscribe link in your email.',
    }));
    return;
  }

  try {
    await unsubscribeUser(req, res);
  } catch (error) {
    console.error('[unsubscribe] Unexpected error:', error);
    sendHtml(res, 500, page({
      title: 'Unsubscribe — PhillyGrind',
      heading: 'Something went wrong',
      body: 'We could not update your email preferences right now. Please try again in a few minutes.',
    }));
  }
}
