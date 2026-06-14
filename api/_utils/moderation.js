const REJECT_CATEGORIES = ['sexual', 'violence', 'hate', 'self-harm', 'harassment'];
export const MODERATION_REJECT_MESSAGE = "Your post was rejected because it violates PhillyGrind's community guidelines.";

export async function moderateText(text) {
  const input = String(text || '').trim();
  if (!input) {
    return { action: 'approve', scores: {}, flaggedCategories: [] };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('OPENAI_API_KEY missing — skipping content moderation.');
    return { action: 'approve', scores: {}, flaggedCategories: [], skipped: true };
  }

  const response = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || 'Content moderation request failed.');
  }

  const result = payload.results?.[0];
  if (!result) {
    return { action: 'approve', scores: {}, flaggedCategories: [] };
  }

  const scores = result.category_scores || {};
  const categories = result.categories || {};

  const hardFlagged = REJECT_CATEGORIES.filter((category) => categories[category]);
  if (hardFlagged.length > 0 || result.flagged) {
    const rejectCategories = hardFlagged.length
      ? hardFlagged
      : REJECT_CATEGORIES.filter((category) => (scores[category] || 0) >= 0.8);

    if (rejectCategories.length || result.flagged) {
      return {
        action: 'reject',
        scores,
        flaggedCategories: rejectCategories.length ? rejectCategories : ['policy'],
      };
    }
  }

  const borderlineCategories = Object.entries(scores)
    .filter(([, score]) => score >= 0.5 && score < 0.8)
    .map(([category]) => category);

  if (borderlineCategories.length) {
    return { action: 'flag', scores, flaggedCategories: borderlineCategories };
  }

  return { action: 'approve', scores, flaggedCategories: [] };
}

export function buildModerationText(fields) {
  return Object.values(fields)
    .filter(Boolean)
    .map((value) => String(value).trim())
    .join('\n');
}
