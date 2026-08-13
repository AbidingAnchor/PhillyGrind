import { moderationRules } from './moderationRules.js';

// Check for available AI providers in environment
const AVAILABLE_PROVIDERS = {
  openai: import.meta.env.OPENAI_API_KEY || import.meta.env.VITE_OPENAI_API_KEY,
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

async function callAI(provider, systemPrompt, userMessage, model = 'gpt-4o-mini', temperature = 0.3) {
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
      temperature,
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

export async function checkModeration(category, content) {
  const provider = getAvailableProvider();
  
  if (!provider) {
    console.warn(`[moderation] No AI provider configured for ${category} check`);
    return { violation: false, skipped: true, reason: 'No AI provider configured' };
  }

  const rule = moderationRules[category];
  
  if (!rule) {
    console.warn(`[moderation] No moderation rule found for category: ${category}`);
    return { violation: false, skipped: true, reason: `No rule for category: ${category}` };
  }
  
  try {
    const result = await callAI(
      provider,
      rule.systemPrompt,
      content,
      rule.model,
      rule.temperature
    );

    const parsed = JSON.parse(result);
    
    // Decision logic
    if (parsed.violation) {
      if (parsed.confidence === 'high') {
        // Auto-reject with immediate feedback
        const flaggedPhrases = parsed.flagged_phrases?.join(', ') || 'certain phrases';
        const error = `Your post contains language that may violate ${rule.name}. Flagged: ${flaggedPhrases}. Please revise and resubmit.`;
        
        // Log to admin reports with auto_rejected status
        await logToAdminReports({
          category,
          ruleName: rule.name,
          content,
          flagged_phrases: parsed.flagged_phrases,
          explanation: parsed.explanation,
          status: 'auto_rejected',
        });
        
        return { violation: true, error, autoRejected: true };
      } else if (parsed.confidence === 'low') {
        // Allow through but flag for review
        await logToAdminReports({
          category,
          ruleName: rule.name,
          content,
          flagged_phrases: parsed.flagged_phrases,
          explanation: parsed.explanation,
          status: 'flagged_for_review',
        });
        
        return { violation: true, flaggedForReview: true };
      }
    }
    
    // No violation - allow through
    return { violation: false };
  } catch (error) {
    console.error(`[moderation] ${category} check failed:`, error);
    // On failure, allow the post but log the error
    return { violation: false, error: error.message, skipped: false };
  }
}

// Convenience functions for each category
export async function checkFairHousingCompliance(description) {
  return checkModeration('housing', description);
}

export async function checkMarketplaceSafety(listing) {
  const content = `${listing.title} ${listing.description} ${listing.price} ${listing.location}`;
  return checkModeration('marketplace', content);
}

export async function checkJobSafety(job) {
  const content = `${job.title} ${job.description} ${job.salary || ''}`;
  return checkModeration('jobs', content);
}

export async function checkGigSafety(gig) {
  const content = `${gig.title} ${gig.description} ${gig.pay || ''}`;
  return checkModeration('gigs', content);
}

export async function checkCommunitySafety(post) {
  return checkModeration('community', post.content);
}

async function logToAdminReports({ category, ruleName, content, flagged_phrases, explanation, status }) {
  try {
    // Import dynamically to avoid circular dependency
    const { supabase } = await import('./supabase.js');
    const { data: userData } = await supabase.auth.getUser();
    
    if (!userData?.user) return;

    // Map category to reported_type that matches admin_reports expectations
    const reportedType = category === 'community' ? 'community' : category;

    const { error } = await supabase
      .from('admin_reports')
      .insert({
        user_id: userData.user.id,
        reported_type: reportedType,
        subjectTitle: `${ruleName} - ${status === 'auto_rejected' ? 'Auto-Rejected' : 'Flagged for Review'}`,
        reason: `Flagged phrases: ${flagged_phrases.join(', ')}`,
        details: explanation,
        description: content.substring(0, 500),
        status,
      });

    if (error) {
      console.error('[moderation] Failed to log to admin reports:', error);
    }
  } catch (error) {
    console.error('[moderation] Failed to log to admin reports:', error);
  }
}
