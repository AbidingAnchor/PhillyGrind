import { moderationRules } from './moderationRules.js';

async function callModerationAPI(category, content) {
  const response = await fetch('/api/moderate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ category, content }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Moderation API failed: ${response.status} - ${error}`);
  }

  return await response.json();
}

export function detectUnder13AgeDisclosure(content) {
  // Patterns that suggest the author is under 13
  const patterns = [
    // Direct age statements under 13
    /\b(i['']?m|i am)\s+(\d{1,2})\s*(years? old|y\.?o\.?|yo)\b/gi,
    /\b(\d{1,2})\s*(years? old|y\.?o\.?|yo)\s+old\b/gi,
    
    // Grade levels under 9th grade
    /\b(\d{1,2})(th|nd|rd|st)\s+grade\b/gi,
    /\b(kindergarten|1st|2nd|3rd|4th|5th|6th|7th|8th)\s+grade\b/gi,
    /\b(elementary\s+school|middle\s+school|junior\s+high)\b/gi,
    
    // School level indicators
    /\b(in\s+(the\s+)?(\d{1,2})(th|nd|rd|st)\s+grade)\b/gi,
    /\b(going\s+to\s+(the\s+)?(elementary|middle|junior\s+high))\b/gi,
    
    // Age-inappropriate context patterns
    /\bmy\s+(mom|dad|parents)\s+(pick\s+me\s+up|drop\s+me\s+off)\b/gi,
    /\bneed\s+(my\s+)?(mom|dad|parents)\s+permission\b/gi,
    /\bgrounded\b/gi,
    /\bhomework\b/gi,
    /\bbedtime\b/gi,
  ];

  for (const pattern of patterns) {
    const matches = content.match(pattern);
    if (matches) {
      // Extract the specific matched content
      const match = matches[0];
      
      // Check if it's a specific age number under 13
      const ageMatch = match.match(/\b(\d{1,2})\b/);
      if (ageMatch) {
        const age = parseInt(ageMatch[1]);
        if (age >= 13) continue; // Not under 13
      }
      
      // Check if it's a grade level under 9th
      const gradeMatch = match.match(/\b(\d{1,2})(th|nd|rd|st)\s+grade\b/i);
      if (gradeMatch) {
        const grade = parseInt(gradeMatch[1]);
        if (grade >= 9) continue; // 9th grade or higher
      }
      
      return {
        detected: true,
        matchedContent: match,
        pattern: pattern.toString(),
      };
    }
  }

  return { detected: false };
}

export async function checkAgeModeration(content, userId, contentType, contentId) {
  const detection = detectUnder13AgeDisclosure(content);
  
  if (!detection.detected) {
    return { flagged: false };
  }

  try {
    const { supabase } = await import('./supabase.js');
    
    // Update user profile with age flag
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        age_flag_status: 'flagged',
        age_flag_content_id: contentId,
      })
      .eq('id', userId);

    if (profileError) {
      console.error('[age moderation] Failed to update profile:', profileError);
    }

    // Soft-hide the content
    let hideError = null;
    if (contentType === 'community_post') {
      const { error } = await supabase
        .from('community_posts')
        .update({
          hidden: true,
          hidden_reason: 'Age Concern - possible under-13 user',
        })
        .eq('id', contentId);
      hideError = error;
    } else if (contentType === 'community_comment') {
      const { error } = await supabase
        .from('community_comments')
        .update({
          hidden: true,
          hidden_reason: 'Age Concern - possible under-13 user',
        })
        .eq('id', contentId);
      hideError = error;
    }

    if (hideError) {
      console.error('[age moderation] Failed to hide content:', hideError);
    }

    // Log to moderation_logs with 'Age Concern' tag
    const { error: logError } = await supabase
      .from('moderation_logs')
      .insert({
        user_id: userId,
        category: 'age_concern',
        rule_name: 'Under-13 Age Disclosure',
        status: 'flagged_for_review',
        flagged_phrases: [detection.matchedContent],
        explanation: 'Content suggests author may be under 13 years old',
        content_preview: content.substring(0, 500),
        content_type: contentType,
        content_id: contentId,
      });

    if (logError) {
      console.error('[age moderation] Failed to log to moderation_logs:', logError);
    }

    return {
      flagged: true,
      matchedContent: detection.matchedContent,
      reason: 'Age Concern - possible under-13 user',
      contentHidden: !hideError,
    };
  } catch (error) {
    console.error('[age moderation] Failed to process age flag:', error);
    return { flagged: false, error: error.message };
  }
}

export async function checkModeration(category, content) {
  const rule = moderationRules[category];
  
  if (!rule) {
    console.warn(`[moderation] No moderation rule found for category: ${category}`);
    return { violation: false, skipped: true, reason: `No rule for category: ${category}` };
  }
  
  try {
    const parsed = await callModerationAPI(category, content);
    
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
  // Run standard moderation check
  const moderationResult = await checkModeration('community', post.content);
  
  // Run age moderation check alongside
  const ageResult = await checkAgeModeration(
    post.content,
    post.user_id,
    'community_post',
    post.id
  );
  
  // Combine results
  return {
    ...moderationResult,
    ageFlagged: ageResult.flagged,
    ageMatchedContent: ageResult.matchedContent,
  };
}

async function logToAdminReports({ category, ruleName, content, flagged_phrases, explanation, status }) {
  try {
    // Import dynamically to avoid circular dependency
    const { supabase } = await import('./supabase.js');
    const { data: userData } = await supabase.auth.getUser();
    
    if (!userData?.user) return;

    const { error } = await supabase
      .from('moderation_logs')
      .insert({
        user_id: userData.user.id,
        category,
        rule_name: ruleName,
        status,
        flagged_phrases,
        explanation,
        content_preview: content.substring(0, 500),
      });

    if (error) {
      console.error('[moderation] Failed to log to moderation_logs:', error);
    }
  } catch (error) {
    console.error('[moderation] Failed to log to moderation_logs:', error);
  }
}
