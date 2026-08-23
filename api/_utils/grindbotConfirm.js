const TICKET_OFFER_PATTERNS = [
  /get this in front of a real person/i,
  /(?:want me to|should i|can i|i can|would you like me to).*(?:file|submit|start|open).*(?:ticket|support)/i,
  /(?:file|submit|start|open) a support ticket/i,
  /(?:file|submit|start|open).*support ticket/i,
  /real person.*(?:ticket|support)/i,
  /support ticket.*(?:file|submit|start|open)/i,
  /want me to get this in front/i,
  /if that doesn'?t (?:work|fix|help|solve)/i,
  /if (?:you|that) (?:still|doesn'?t|does not)/i,
  /(?:let me know|just say|just tell me).*(?:ticket|real person|human)/i,
  /i can (?:also\s*)?(?:file|submit|open|get).*(?:ticket|real person|support)/i,
  /(?:otherwise|or),?\s*i can.*(?:ticket|real person|support)/i,
  /if you(?:'d| would) like.*(?:ticket|real person|support)/i,
  /(?:happy|glad) to (?:file|submit|open|get).*(?:ticket|support)/i,
  /(?:can|could) get this (?:in front of|to).*(?:real person|support|team)/i,
];

const DIRECT_TICKET_REQUEST_PATTERNS = [
  /(?:file|submit|open|create|start)\s+(?:this|the|my)\s+(?:support\s+)?ticket/i,
  /(?:can you|could you|will you|would you)\s+(?:just\s+)?(?:file|submit|open|create|start)\s+(?:this|the|my|a)\s+(?:support\s+)?ticket/i,
  /(?:just|please)\s*(?:make|file|submit|open|create|start)\s*(?:me\s*)?(?:a\s*)?(?:support\s*)?ticket/i,
  /(?:make|file|submit|open|create|start)\s*(?:me\s*)?(?:a\s*)?(?:support\s*)?ticket/i,
  /can you (?:just\s*)?(?:make|file|submit|open|create|start)\s*(?:a\s*)?(?:support\s*)?ticket/i,
  /could you (?:just\s*)?(?:make|file|submit|open|create|start)\s*(?:a\s*)?(?:support\s*)?ticket/i,
  /(?:i\s*)?(?:want|need)\s*(?:a\s*)?(?:human|real person|someone from support|support person)/i,
  /(?:talk|speak)\s*to\s*(?:a\s*)?(?:human|real person|someone|support)/i,
  /get me (?:a\s*)?(?:human|real person|support)/i,
  /(?:please\s*)?file (?:this|it) (?:for me|with support)/i,
  /(?:please\s*)?submit (?:this|it) (?:as\s*)?(?:a\s*)?ticket/i,
  /open (?:a\s*)?(?:support\s*)?ticket (?:for me|please)/i,
  /create (?:a\s*)?(?:support\s*)?ticket/i,
  /start (?:a\s*)?(?:support\s*)?ticket/i,
  /human support/i,
  /get this to (?:a\s*)?(?:real person|support)/i,
];

const TICKET_FILED_PATTERNS = [
  /ticket has been submitted/i,
  /support ticket has been submitted/i,
  /i'?ve submitted your (?:support )?ticket/i,
  /i'?ve filed (?:this|your|a)/i,
  /filed this for our (?:support )?team/i,
  /your ticket (?:is|has been) (?:submitted|filed|in)/i,
  /submitted your ticket/i,
];

const AFFIRMATIVE_PHRASES = [
  /^yes\b/i,
  /^yeah\b/i,
  /^yep\b/i,
  /^yup\b/i,
  /^sure\b/i,
  /^ok(?:ay)?\b/i,
  /^please\b/i,
  /go ahead/i,
  /please do/i,
  /please file/i,
  /file it/i,
  /submit it/i,
  /\bdo it\b/i,
  /sounds good/i,
  /that works/i,
  /go for it/i,
  /file the ticket/i,
  /submit the ticket/i,
  /submit a ticket/i,
  /yes please/i,
  /yes, please/i,
];

const NEGATIVE_PHRASES = [
  /^no\b/i,
  /^nah\b/i,
  /no thanks/i,
  /no thank you/i,
  /never mind/i,
  /nevermind/i,
  /not now/i,
  /^cancel\b/i,
  /\bdon't\b/i,
  /\bdo not\b/i,
  /no need/i,
];

const CATEGORY_RULES = [
  { category: 'data_deletion', pattern: /data deletion|delete my (account|data|profile)/i },
  { category: 'fair_housing_complaint', pattern: /fair housing|discriminat|source of income|housing complaint/i },
  { category: 'dispute_report', pattern: /dispute|escrow|refund|chargeback|payment issue|order issue/i },
  { category: 'other', pattern: /\bother\b/i },
];

export function normalizeChatMessages(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((message) => ['user', 'assistant'].includes(message?.role))
    .map((message) => ({
      role: message.role,
      content: String(message.content || '').trim(),
      meta: message.meta || null,
      kind: message.kind || null,
    }))
    .filter((message) => message.content || message.meta?.awaitingTicketConfirm || message.kind === 'ticket_offer');
}

export function isDirectTicketRequest(text) {
  const value = String(text || '').trim();
  if (!value || value.length > 220) return false;
  return DIRECT_TICKET_REQUEST_PATTERNS.some((pattern) => pattern.test(value));
}

export function isTicketOfferMessage(text) {
  const value = String(text || '').trim();
  if (!value || isTicketFiledMessage(value)) return false;
  return TICKET_OFFER_PATTERNS.some((pattern) => pattern.test(value));
}

export function isTicketFiledMessage(text) {
  const value = String(text || '').trim();
  if (!value) return false;
  return TICKET_FILED_PATTERNS.some((pattern) => pattern.test(value));
}

function isOfferLikeAssistantMessage(message) {
  if (!message) return false;
  return (
    message.meta?.awaitingTicketConfirm === true
    || message.kind === 'ticket_offer'
    || isTicketOfferMessage(message.content)
  );
}

export function classifyConfirmation(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return 'ambiguous';

  if (isDirectTicketRequest(trimmed)) return 'yes';

  if (trimmed.length > 80) return 'ambiguous';
  if (/\bbut\b|\bhowever\b|\balso\b/.test(trimmed)) return 'ambiguous';
  if (/\?/.test(trimmed) && !isDirectTicketRequest(trimmed)) return 'ambiguous';

  const lower = trimmed.toLowerCase();
  const negative = NEGATIVE_PHRASES.some((pattern) => pattern.test(lower));
  const affirmative = AFFIRMATIVE_PHRASES.some((pattern) => pattern.test(lower));

  if (negative && affirmative) return 'ambiguous';
  if (negative) return 'no';
  if (affirmative) return 'yes';
  return 'ambiguous';
}

function lastAssistantBeforeIndex(messages, beforeIndex) {
  for (let index = beforeIndex - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'assistant') return messages[index];
  }
  return null;
}

function messageHasTroubleshootingContent(text) {
  return /(?:try|check|go to|head to|make sure|verify|step \d|first,|next,|looks like|i see|found|should|could|might|escrow|order|listing|payout|bid)/i.test(
    String(text || ''),
  );
}

function isWelcomeOnlyMessage(text) {
  return /^hey!? i'?m grindbot/i.test(String(text || '').trim());
}

function isTroubleshootingAssistantMessage(message) {
  if (!message || message.role !== 'assistant') return false;
  if (isTicketFiledMessage(message.content)) return false;
  if (isWelcomeOnlyMessage(message.content)) return false;
  if (message.content.length < 20) return false;
  if (isTicketOfferMessage(message.content) && !messageHasTroubleshootingContent(message.content)) return false;
  return true;
}

function hasAssistantTroubleshooting(messages, beforeIndex = messages.length) {
  return messages
    .slice(0, beforeIndex)
    .some((message) => isTroubleshootingAssistantMessage(message));
}

export function isAwaitingTicketConfirm(messages, clientHint = null) {
  if (clientHint?.awaitingTicketConfirm) return true;

  const chat = normalizeChatMessages(messages);
  if (chat.length < 2 || chat[chat.length - 1].role !== 'user') return false;

  const lastUserText = chat[chat.length - 1].content;
  if (isDirectTicketRequest(lastUserText)) return true;

  const offerMessage = lastAssistantBeforeIndex(chat, chat.length);
  if (!offerMessage) return false;

  return isOfferLikeAssistantMessage(offerMessage);
}

export function passesTicketConfirmSafetyGates(messages) {
  const chat = normalizeChatMessages(messages);
  if (chat.length < 3 || chat[chat.length - 1].role !== 'user') return false;

  const userMessages = chat.filter((message) => message.role === 'user');
  if (userMessages.length < 2) return false;

  if (chat.some((message) => message.role === 'assistant' && isTicketFiledMessage(message.content))) {
    return false;
  }

  const confirmationText = userMessages[userMessages.length - 1].content;
  const intent = classifyConfirmation(confirmationText);
  if (intent !== 'yes') return false;

  const priorUserMessages = userMessages.slice(0, -1);
  const hasSubstantiveIssue = priorUserMessages.some((message) => message.content.length >= 30);
  if (!hasSubstantiveIssue) return false;

  if (!hasAssistantTroubleshooting(chat)) return false;

  const directRequest = isDirectTicketRequest(confirmationText);
  if (directRequest) return true;

  const offerMessage = lastAssistantBeforeIndex(chat, chat.length);
  return Boolean(offerMessage && isOfferLikeAssistantMessage(offerMessage));
}

export function debugTicketConfirmGates(messages, clientHint = null) {
  const chat = normalizeChatMessages(messages);
  const userMessages = chat.filter((message) => message.role === 'user');
  const lastUserText = chat[chat.length - 1]?.content || '';
  const confirmationText = userMessages[userMessages.length - 1]?.content || '';
  const priorUserMessages = userMessages.slice(0, -1);
  const offerMessage = lastAssistantBeforeIndex(chat, chat.length);
  const troubleshootingAssistants = chat
    .slice(0, chat.length)
    .filter((message) => isTroubleshootingAssistantMessage(message))
    .map((message) => message.content.slice(0, 120));

  const gates = {
    chatLengthOk: chat.length >= 3,
    lastRoleIsUser: chat[chat.length - 1]?.role === 'user',
    userTurnCountOk: userMessages.length >= 2,
    noTicketAlreadyFiled: !chat.some(
      (message) => message.role === 'assistant' && isTicketFiledMessage(message.content),
    ),
    confirmIntentYes: classifyConfirmation(confirmationText) === 'yes',
    substantivePriorIssue: priorUserMessages.some((message) => message.content.length >= 30),
    hasTroubleshootingAssistant: hasAssistantTroubleshooting(chat),
    isDirectTicketRequest: isDirectTicketRequest(confirmationText),
    lastAssistantIsOfferLike: Boolean(offerMessage && isOfferLikeAssistantMessage(offerMessage)),
  };

  let failedGate = null;
  if (!gates.chatLengthOk) failedGate = 'chat_length_lt_3';
  else if (!gates.lastRoleIsUser) failedGate = 'last_message_not_user';
  else if (!gates.userTurnCountOk) failedGate = 'user_turn_count_lt_2';
  else if (!gates.noTicketAlreadyFiled) failedGate = 'ticket_already_filed_in_thread';
  else if (!gates.confirmIntentYes) failedGate = 'confirm_intent_not_yes';
  else if (!gates.substantivePriorIssue) failedGate = 'no_substantive_prior_issue';
  else if (!gates.hasTroubleshootingAssistant) failedGate = 'no_troubleshooting_assistant';
  else if (!gates.isDirectTicketRequest && !gates.lastAssistantIsOfferLike) {
    failedGate = 'needs_offer_like_assistant_for_non_direct_confirm';
  }

  return {
    lastUserText,
    isDirectTicketRequest: gates.isDirectTicketRequest,
    classifyConfirmation: classifyConfirmation(lastUserText),
    isAwaitingTicketConfirm: isAwaitingTicketConfirm(messages, clientHint),
    passesTicketConfirmSafetyGates: passesTicketConfirmSafetyGates(messages),
    failedGate,
    gates,
    troubleshootingAssistants,
    lastAssistantPreview: offerMessage?.content?.slice(0, 160) || null,
  };
}

export function inferTicketCategory(text) {
  const value = String(text || '');
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(value)) return rule.category;
  }
  return 'general';
}

function isConfirmIntentMessage(text) {
  return classifyConfirmation(text) !== 'ambiguous';
}

export function buildTicketDraft(messages) {
  const chat = normalizeChatMessages(messages);
  const userMessages = chat.filter((message) => message.role === 'user');

  let issueMessages = userMessages;
  if (userMessages.length > 1 && isConfirmIntentMessage(userMessages[userMessages.length - 1].content)) {
    issueMessages = userMessages.slice(0, -1);
  }

  const body = issueMessages
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 4000);

  return {
    category: inferTicketCategory(body),
    message: body || 'Support request via GrindBot.',
  };
}

export function buildTicketConfirmMeta(messages, assistantReply) {
  const chat = normalizeChatMessages(messages);
  if (!isTicketOfferMessage(assistantReply)) return null;

  if (!passesTicketConfirmSafetyGates([
    ...chat,
    { role: 'user', content: 'yes' },
  ])) {
    return null;
  }

  return {
    awaitingTicketConfirm: true,
    ticketDraft: buildTicketDraft(chat),
  };
}
