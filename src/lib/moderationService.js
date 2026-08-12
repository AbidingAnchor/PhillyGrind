import { MODERATION_RULES } from './moderationRules.js';

// Check for available AI providers in environment
const AVAILABLE_PROVIDERS = {
  openai: import.meta.env.VITE_OPENAI_API_KEY,
  groq: import.meta.env.VITE_GROQ_API_KEY,
};

function getAvailableProvider() {
  if (AVAILABLE_PROVIDERS.openai) {
    return { provider: 'openai', apiKey: AVAILABLE_PROVIDERS.openai, endpoint: 'https://api.openai.com/v1/chat/completions' };
  }
  if (AVAILABLE_PROVIDERS.groq) {
    return { provider: 'groq', apiKey: AVAILABLE_PROVIDERS.groq, endpoint: 'https://api.groq.com/openai/v1/chat/completions' };
  }
  return null;
}

async function callAI(provider, systemPrompt, userMessage, model = 'gpt-4o-mini') {
  const { apiKey, endpoint } = provider;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI moderation failed: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export async function checkFairHousingCompliance(description) {
  const provider = getAvailableProvider();
  
  if (!provider) {
    console.warn('[moderation] No AI provider configured for Fair Housing check');
    return { violation: false, skipped: true, reason: 'No AI provider configured' };
  }

  const rule = MODERATION_RULES.fairHousing;
  
  try {
    const result = await callAI(
      provider,
      rule.systemPrompt,
      description,
      rule.model
    );

    const parsed = JSON.parse(result);
    
    // Log to admin reports if violation found
    if (parsed.violation) {
      await logToAdminReports({
        type: 'fair_housing',
        description,
        flagged_phrases: parsed.flagged_phrases,
        explanation: parsed.explanation,
      });
    }

    return parsed;
  } catch (error) {
    console.error('[moderation] Fair Housing check failed:', error);
    // On failure, allow the post but log the error
    return { violation: false, error: error.message, skipped: false };
  }
}

async function logToAdminReports({ type, description, flagged_phrases, explanation }) {
  try {
    // Import dynamically to avoid circular dependency
    const { supabase } = await import('./supabase.js');
    const { data: userData } = await supabase.auth.getUser();
    
    if (!userData?.user) return;

    const { error } = await supabase
      .from('admin_reports')
      .insert({
        user_id: userData.user.id,
        reported_type: type,
        subjectTitle: 'Fair Housing Violation Detected',
        reason: `Flagged phrases: ${flagged_phrases.join(', ')}`,
        details: explanation,
        description: description.substring(0, 500),
        status: 'pending',
      });

    if (error) {
      console.error('[moderation] Failed to log to admin reports:', error);
    }
  } catch (error) {
    console.error('[moderation] Failed to log to admin reports:', error);
  }
}
