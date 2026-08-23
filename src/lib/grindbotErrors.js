const USER_BUSY_MESSAGE = "I'm handling a lot right now — give me a second and try again.";
const USER_DOWN_MESSAGE = 'GrindBot is taking five. Try again in a minute.';

export function grindBotUserFacingError(raw) {
  const text = String(raw || '').trim();
  if (text === USER_BUSY_MESSAGE || text === USER_DOWN_MESSAGE) return text;
  if (
    /rate limit|tokens per|token.?limit|tpm\b|upgrade to|dev tier|groq|openai\/gpt-oss|billing|try again in \d|please reduce/i.test(
      text,
    )
  ) {
    return USER_BUSY_MESSAGE;
  }
  if (/authentication required/i.test(text)) return 'Sign in to chat with GrindBot.';
  return USER_DOWN_MESSAGE;
}

export { USER_BUSY_MESSAGE, USER_DOWN_MESSAGE };
