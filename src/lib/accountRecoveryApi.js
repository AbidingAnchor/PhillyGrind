export async function startAccountRecovery(identifier) {
  const response = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'start-recovery', identifier }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Could not start account recovery.');
  }
  return payload;
}

export async function submitAccountRecovery({ challengeId, identifier, answers, newEmail }) {
  const response = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'submit-recovery',
      challengeId,
      identifier,
      answers,
      newEmail,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Could not submit your recovery request.');
  }
  return payload;
}

export async function completeAccountRecoveryReset({ token, password }) {
  const response = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'complete-recovery-reset',
      token,
      password,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Could not update your password.');
  }
  return payload;
}
