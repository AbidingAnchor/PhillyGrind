import { grindBotUserFacingError } from './grindbotErrors.js';

export async function sendGrindBotMessage({ token, messages, clientHint = null }) {
  const response = await fetch('/api/grindbotai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messages,
      clientHint,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(grindBotUserFacingError(payload.error));
  }
  if (!payload.reply && !payload.meta?.ticketFiled) {
    throw new Error(grindBotUserFacingError(''));
  }

  return payload;
}
