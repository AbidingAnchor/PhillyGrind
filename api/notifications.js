import { getUserFromRequest, requireMethod, sendJson, supabaseAdmin } from './_utils.js';
import { sendEmail } from './_utils/email.js';
import { createCommentOnPostEmail } from './_utils/emailTemplate.js';
import { createRateLimiter, checkRateLimit, consumeRateLimit } from './_utils/rateLimit.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PREVIEW_LENGTH = 120;

const requestLimiter = createRateLimiter(30, '60 s');
const commentEmailCooldown = createRateLimiter(1, '2 m');

function getSiteUrl() {
  const raw = process.env.PUBLIC_SITE_URL || process.env.SITE_URL || 'https://www.phillygrind.work';
  return String(raw).replace(/\/+$/, '');
}

function previewText(value) {
  const collapsed = String(value || '').replace(/\s+/g, ' ').trim();
  if (collapsed.length <= PREVIEW_LENGTH) return collapsed;
  return `${collapsed.slice(0, PREVIEW_LENGTH).trim()}…`;
}

function displayName(value) {
  const trimmed = String(value || '').replace(/\s+/g, ' ').trim();
  if (!trimmed || EMAIL_RE.test(trimmed)) return 'A neighbor';
  return trimmed;
}

async function handleCommentOnPost(req, res, user) {
  const commentId = req.body?.comment_id;
  if (!commentId || !UUID_RE.test(commentId)) {
    sendJson(res, 400, { error: 'A valid comment_id is required.' });
    return;
  }

  const { data: comment, error: commentError } = await supabaseAdmin
    .from('community_comments')
    .select('id, post_id, user_id, content, hidden')
    .eq('id', commentId)
    .maybeSingle();

  if (commentError) throw commentError;
  if (!comment) {
    sendJson(res, 404, { error: 'Comment not found.' });
    return;
  }

  if (comment.user_id !== user.id) {
    sendJson(res, 403, { error: 'Only the commenter can trigger this notification.' });
    return;
  }

  if (comment.hidden) {
    sendJson(res, 200, { skipped: true, reason: 'hidden' });
    return;
  }

  const { data: post, error: postError } = await supabaseAdmin
    .from('community_posts')
    .select('id, user_id, hidden')
    .eq('id', comment.post_id)
    .maybeSingle();

  if (postError) throw postError;
  if (!post || post.hidden) {
    sendJson(res, 200, { skipped: true, reason: 'post' });
    return;
  }

  if (post.user_id === comment.user_id) {
    sendJson(res, 200, { skipped: true, reason: 'self' });
    return;
  }

  const [{ data: author, error: authorError }, { data: commenter, error: commenterError }] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id, email, name, email_comment_notifications')
      .eq('id', post.user_id)
      .maybeSingle(),
    supabaseAdmin
      .from('profiles')
      .select('id, name')
      .eq('id', comment.user_id)
      .maybeSingle(),
  ]);

  if (authorError) throw authorError;
  if (commenterError) throw commenterError;

  if (!author?.email || !EMAIL_RE.test(author.email)) {
    sendJson(res, 200, { skipped: true, reason: 'no-email' });
    return;
  }

  if (author.email_comment_notifications === false) {
    sendJson(res, 200, { skipped: true, reason: 'opt-out' });
    return;
  }

  const cooldownKey = `comment-email:${post.user_id}:${post.id}`;
  const allowed = await consumeRateLimit(commentEmailCooldown, cooldownKey);
  if (!allowed) {
    sendJson(res, 200, { skipped: true, reason: 'cooldown' });
    return;
  }

  const siteUrl = getSiteUrl();
  const commenterName = displayName(commenter?.name);
  const { subject, html } = createCommentOnPostEmail({
    commenterName,
    commentPreview: previewText(comment.content) || 'New comment',
    postUrl: `${siteUrl}/?post=${encodeURIComponent(post.id)}`,
    settingsUrl: `${siteUrl}/settings`,
  });

  await sendEmail({
    to: author.email,
    subject,
    html,
  });

  sendJson(res, 200, { sent: true });
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;

  const identifier = req.headers['x-forwarded-for'] || 'anonymous';
  if (!(await checkRateLimit(requestLimiter, identifier, res))) return;

  const action = req.query?.action || req.body?.action;
  if (action !== 'comment-on-post') {
    sendJson(res, 400, { error: 'Unknown action.' });
    return;
  }

  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      sendJson(res, 401, { error: 'Authentication required.' });
      return;
    }

    await handleCommentOnPost(req, res, user);
  } catch (error) {
    console.error('[notifications] comment-on-post failed:', error);
    sendJson(res, 500, { error: 'Could not send comment notification.' });
  }
}
