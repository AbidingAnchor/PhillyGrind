import { createHmac, timingSafeEqual } from 'node:crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const DEFAULT_SITE_URL = 'https://phillygrind.work';

function getUnsubscribeSecret() {
  return (
    process.env.UNSUBSCRIBE_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || ''
  );
}

export function createUnsubscribeToken(userId) {
  const secret = getUnsubscribeSecret();
  if (!secret) {
    throw new Error('Missing unsubscribe signing secret.');
  }
  const id = String(userId || '').trim();
  if (!UUID_RE.test(id)) {
    throw new Error('A valid user id is required to create an unsubscribe token.');
  }
  const hmac = createHmac('sha256', secret).update(id).digest('base64url');
  return `${id}.${hmac}`;
}

export function verifyUnsubscribeToken(token) {
  const secret = getUnsubscribeSecret();
  if (!secret || typeof token !== 'string') return null;

  const lastDot = token.lastIndexOf('.');
  if (lastDot <= 0) return null;

  const userId = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1);
  if (!UUID_RE.test(userId) || !signature) return null;

  const expected = createHmac('sha256', secret).update(userId).digest('base64url');
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;
  return userId;
}

export function createUnsubscribeUrl(userId, siteUrl = DEFAULT_SITE_URL) {
  const base = String(siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, '');
  return `${base}/api/unsubscribe?token=${encodeURIComponent(createUnsubscribeToken(userId))}`;
}

function unsubscribePage({ title, heading, body }) {
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
              <a href="${DEFAULT_SITE_URL}" style="color:#16a34a;text-decoration:none;font-size:14px;font-weight:600;">Back to PhillyGrind</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function sendUnsubscribePage(res, status, { title, heading, body }) {
  res.status(status);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(unsubscribePage({ title, heading, body }));
}

export async function handleUnsubscribeRequest(req, res, { hasServerSupabaseConfig, supabaseAdmin }) {
  const token = typeof req.query?.token === 'string' ? req.query.token : '';
  const userId = verifyUnsubscribeToken(token);

  if (!userId) {
    sendUnsubscribePage(res, 400, {
      title: 'Unsubscribe — PhillyGrind',
      heading: 'This unsubscribe link is invalid',
      body: 'The link may be incomplete or expired. If you still receive emails from us, reply to that message or contact support@phillygrind.work.',
    });
    return;
  }

  if (!hasServerSupabaseConfig) {
    sendUnsubscribePage(res, 500, {
      title: 'Unsubscribe — PhillyGrind',
      heading: 'Something went wrong',
      body: 'We could not update your email preferences right now. Please try again in a few minutes.',
    });
    return;
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ unsubscribed: true })
    .eq('id', userId);

  if (error) {
    console.error('[unsubscribe] Failed to update profile:', error);
    sendUnsubscribePage(res, 500, {
      title: 'Unsubscribe — PhillyGrind',
      heading: 'Something went wrong',
      body: 'We could not update your email preferences right now. Please try again in a few minutes.',
    });
    return;
  }

  sendUnsubscribePage(res, 200, {
    title: 'Unsubscribed — PhillyGrind',
    heading: "You're unsubscribed",
    body: "You won't receive marketing emails from PhillyGrind anymore. Transactional mail such as login codes and account recovery may still be sent when needed.",
  });
}
